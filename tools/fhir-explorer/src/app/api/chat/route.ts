// Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.

import { createOpenAI, type OpenAILanguageModelChatOptions } from "@ai-sdk/openai";
import {
  APICallError,
  createAgentUIStreamResponse,
  RetryError,
  stepCountIs,
  ToolLoopAgent,
  type UIMessage,
} from "ai";
import { encodeBlockedError, encodeBudgetError, resetAtFromHeader } from "@/lib/chat-rate-limit";
import type { FhirChatMessageMetadata } from "@/lib/fhir-chat-types";
import { FHIR_CHAT_INSTRUCTIONS } from "@/lib/server/chat-agent-instructions";
import { getReadOnlyFhirMcpTools } from "@/lib/server/fhir-mcp";
import { clientKey, isRateLimited } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Per-IP cap. The edge nginx limits /api/chat to 6r/s per user and 12r/s per IP
// (iac/sandbox/fhir-explorer/nginx/workload.yaml), so this 10/min cap is the
// tighter of the two. Each request spends up to 10 LLM tool-loop steps.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

// The AI SDK wants a /v1 base; the gateway injects it host-root — append /v1.
function openAiBaseUrl(): string | undefined {
  const raw = process.env.OPENAI_BASE_URL?.trim().replace(/\/+$/, "");
  if (!raw) return undefined;
  return raw.endsWith("/v1") ? raw : `${raw}/v1`;
}

function openAiFor() {
  const baseURL = openAiBaseUrl();
  return createOpenAI(baseURL ? { baseURL } : {});
}

type ReasoningEffort = NonNullable<OpenAILanguageModelChatOptions["reasoningEffort"]>;

const REASONING_EFFORTS: readonly ReasoningEffort[] = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

function reasoningEffort(): ReasoningEffort {
  const value = process.env.OPENAI_REASONING_EFFORT?.trim() || "high";
  const match = REASONING_EFFORTS.find((effort) => effort === value);
  if (!match) {
    throw new Error(
      `Unknown OPENAI_REASONING_EFFORT '${value}'. Use one of: ${REASONING_EFFORTS.join(", ")}.`,
    );
  }
  return match;
}

interface FhirChatRequestBody {
  messages?: UIMessage[];
}

export async function POST(request: Request) {
  if (isRateLimited(clientKey(request), RATE_LIMIT, RATE_WINDOW_MS)) {
    return Response.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "The chatbot is not configured. Set OPENAI_API_KEY on the server." },
      { status: 503 },
    );
  }

  let body: FhirChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "At least one chat message is required." }, { status: 400 });
  }
  try {
    const tools = await getReadOnlyFhirMcpTools();
    const startedAt = Date.now();
    let fhirCalls = 0;

    const agent = new ToolLoopAgent({
      id: "fhir-explorer-read-only-agent",
      // .chat pins /chat/completions — the path the gateway provider allowlists.
      model: openAiFor().chat(process.env.OPENAI_MODEL?.trim() || "gpt-5-nano"),
      tools,
      stopWhen: stepCountIs(10),
      providerOptions: { openai: { reasoningEffort: reasoningEffort() } },
      // Hardened, read-only scope: one layer behind the gateway guardrails and MCP.
      instructions: FHIR_CHAT_INSTRUCTIONS,
    });

    return await createAgentUIStreamResponse({
      agent,
      uiMessages: body.messages,
      abortSignal: request.signal,
      onStepFinish: ({ toolCalls }) => {
        fhirCalls += toolCalls.length;
      },
      messageMetadata: ({ part }): FhirChatMessageMetadata | undefined => {
        if (part.type !== "finish") return undefined;
        return {
          elapsedMs: Date.now() - startedAt,
          fhirCalls,
          inputTokens: part.totalUsage.inputTokens,
          outputTokens: part.totalUsage.outputTokens,
          totalTokens: part.totalUsage.totalTokens,
        };
      },
      onError: (error) => {
        // The gateway rejects with 429 once the user's weekly LLM budget is
        // spent. It can hit mid tool-loop, where the SDK retries and rethrows a
        // RetryError, so unwrap to the underlying APICallError before matching.
        const cause = RetryError.isInstance(error) ? error.lastError : error;
        if (APICallError.isInstance(cause) && cause.statusCode === 429) {
          return encodeBudgetError(resetAtFromHeader(cause.responseHeaders?.["x-ratelimit-reset"]));
        }
        // The gateway content guardrail refuses out-of-scope prompts with 422.
        if (APICallError.isInstance(cause) && cause.statusCode === 422) {
          return encodeBlockedError();
        }
        console.error("FHIR chat stream failed:", error instanceof Error ? error.message : error);
        return "The FHIR assistant could not complete this request.";
      },
    });
  } catch (error) {
    console.error("FHIR chat request failed:", error instanceof Error ? error.message : error);
    return Response.json(
      { error: "The FHIR assistant could not connect or complete this request." },
      { status: 502 },
    );
  }
}
