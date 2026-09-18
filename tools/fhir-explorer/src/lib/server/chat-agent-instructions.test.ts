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

import { describe, expect, it } from "vitest";
import { FHIR_CHAT_INSTRUCTIONS } from "@/lib/server/chat-agent-instructions";

const requiredRules = [
  [
    "check capabilities before any resource operation",
    "Call get_capabilities before searching or reading a resource type.",
  ],
  ["plan the answer shape before searching", "Decide what shape the answer needs before searching"],
  ["know the standard result-shaping parameters", "even when get_capabilities does not list them"],
  ["request an exact count with _summary=count", "_summary=count"],
  ["request an accurate total alongside results", "_total=accurate"],
  [
    "follow up once before reporting a data gap",
    "make one targeted follow-up call rather than reporting the gap",
  ],
  ["reserve the final step of the tool budget", "hard budget of ten tool-loop steps"],
  ["refuse write operations", "cannot create, update, patch, or delete FHIR data"],
];

describe("FHIR chat agent instructions", () => {
  it.each(requiredRules)("require that the agent %s", (_rule, phrase) => {
    expect(FHIR_CHAT_INSTRUCTIONS).toContain(phrase);
  });
});
