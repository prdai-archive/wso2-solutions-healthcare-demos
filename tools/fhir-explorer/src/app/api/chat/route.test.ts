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

import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function importChatRoute() {
  vi.resetModules();
  return import("./route");
}

describe("chat route configuration", () => {
  it("rejects an unknown OPENAI_REASONING_EFFORT at module initialization", async () => {
    vi.stubEnv("OPENAI_REASONING_EFFORT", "turbo");
    await expect(importChatRoute()).rejects.toThrow("OPENAI_REASONING_EFFORT");
  });

  it("accepts a configured reasoning effort", async () => {
    vi.stubEnv("OPENAI_REASONING_EFFORT", "low");
    await expect(importChatRoute()).resolves.toBeDefined();
  });
});
