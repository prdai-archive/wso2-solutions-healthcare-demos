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

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BundleLike } from "@/lib/fhir-types";
import { useBundlePager } from "./use-bundle-pager";

const BASE = "https://example.org/fhir/r4";

function entries(count: number): NonNullable<BundleLike["entry"]> {
  return Array.from({ length: count }, (_, index) => ({
    resource: { resourceType: "Patient", id: `p${index + 1}` },
  }));
}

function selfLinkedBundle(page: number, total: number): BundleLike {
  return {
    resourceType: "Bundle",
    total,
    entry: entries(5),
    link: [{ relation: "self", url: `${BASE}/Patient?_count=5&_page=${page}&_total=accurate` }],
  };
}

describe("useBundlePager", () => {
  it("derives server-page availability from the self link when relation links are absent", () => {
    const { result } = renderHook(() =>
      useBundlePager(selfLinkedBundle(1, 100), 5, { load: vi.fn() }),
    );

    expect(result.current.canNext).toBe(true);
    expect(result.current.showLast).toBe(true);
    expect(result.current.canFirst).toBe(false);
    expect(result.current.canPrevious).toBe(false);

    act(() => result.current.goToPage(3));

    expect(result.current.canFirst).toBe(true);
    expect(result.current.showFirst).toBe(true);
    expect(result.current.canPrevious).toBe(true);
  });

  it("ignores further navigation while a server-page request is in flight", async () => {
    let resolveLoad: (() => void) | undefined;
    const load = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const { result } = renderHook(() => useBundlePager(selfLinkedBundle(1, 100), 5, { load }));

    act(() => result.current.goToPage(3));
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.page).toBe(3);

    act(() => result.current.goToPage(4));
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.page).toBe(3);

    await act(async () => {
      resolveLoad?.();
    });

    act(() => result.current.goToPage(4));
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.page).toBe(4);
  });

  it("keeps local slicing availability from page bounds", () => {
    const local: BundleLike = { resourceType: "Bundle", entry: entries(10) };
    const { result } = renderHook(() => useBundlePager(local, 5, { load: vi.fn() }));

    expect(result.current.total).toBe(10);
    expect(result.current.canNext).toBe(true);
    expect(result.current.canPrevious).toBe(false);
    expect(result.current.showFirst).toBe(false);
    expect(result.current.showLast).toBe(false);

    act(() => result.current.goNext());

    expect(result.current.page).toBe(2);
    expect(result.current.canNext).toBe(false);
    expect(result.current.canPrevious).toBe(true);
  });
});
