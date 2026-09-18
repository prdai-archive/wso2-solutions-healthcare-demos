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
import { CHAT_STEP_LIMIT, prepareChatStep } from "@/lib/server/chat-agent-steps";

describe("FHIR chat agent step budget", () => {
  it("disables tools on the final generation", () => {
    expect(prepareChatStep({ stepNumber: CHAT_STEP_LIMIT - 1 })).toEqual({ toolChoice: "none" });
  });

  it("leaves earlier generations free to call tools", () => {
    const earlierSteps = Array.from({ length: CHAT_STEP_LIMIT - 1 }, (_, stepNumber) => stepNumber);
    for (const stepNumber of earlierSteps) {
      expect(prepareChatStep({ stepNumber })).toBeUndefined();
    }
  });
});
