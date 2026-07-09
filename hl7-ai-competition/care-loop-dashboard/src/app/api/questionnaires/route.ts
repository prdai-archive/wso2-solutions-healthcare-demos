import process from "node:process";

import { NextResponse } from "next/server";

import { insertRequestLog, updateRequestLog } from "@/lib/db";

export const runtime = "nodejs";

// Fire-and-forget: care-loop-ai-service's POST /questionnaires can take a
// while (it's an ai:Agent round-tripping through the FHIR MCP toolkit), so
// this route logs the request, kicks it off in the background, and returns
// immediately rather than blocking the UI on the draft coming back.
export async function POST(request: Request) {
  const body = (await request.json()) as { patientId?: string };
  const patientId = body.patientId;
  if (!patientId) {
    return NextResponse.json({ message: "patientId is required" }, { status: 400 });
  }

  const baseUrl = process.env.CARE_LOOP_AI_SERVICE_URL ?? "http://localhost:8003";
  const logId = insertRequestLog(patientId, "care-loop-ai-service POST /questionnaires");

  void fetch(`${baseUrl}/questionnaires`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ patientId }),
  })
    .then(async (response) => {
      if (response.ok) {
        updateRequestLog(logId, "ok", `HTTP ${response.status}`);
      } else {
        const text = await response.text();
        updateRequestLog(logId, "error", `HTTP ${response.status}: ${text.slice(0, 200)}`);
      }
    })
    .catch((error: unknown) => {
      updateRequestLog(logId, "error", error instanceof Error ? error.message : String(error));
    });

  return NextResponse.json({ sent: true, logId }, { status: 202 });
}
