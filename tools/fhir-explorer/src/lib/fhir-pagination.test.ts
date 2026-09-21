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

import type { BundleLike } from "./fhir-types";
import { pageLinkUrl, pageNumbers } from "./fhir-pagination";

const BASE = "https://example.org/fhir/r4";

const bundle: BundleLike = {
  resourceType: "Bundle",
  link: [
    { relation: "self", url: `${BASE}/Patient?_count=5&_page=3&_total=accurate` },
    { relation: "first", url: `${BASE}/Patient?_count=5&_page=1&_total=accurate` },
    { relation: "last", url: `${BASE}/Patient?_count=5&_page=20&_total=accurate` },
    { relation: "next", url: `${BASE}/Patient?_count=5&_page=4&_total=accurate` },
    { relation: "previous", url: `${BASE}/Patient?_count=5&_page=2&_total=accurate` },
  ],
};

describe("pageLinkUrl", () => {
  it("follows the next link for the page after the current one", () => {
    expect(pageLinkUrl(bundle, 4, 3, 20)).toBe(`${BASE}/Patient?_count=5&_page=4&_total=accurate`);
  });

  it("follows the previous link for the page before the current one", () => {
    expect(pageLinkUrl(bundle, 2, 3, 20)).toBe(`${BASE}/Patient?_count=5&_page=2&_total=accurate`);
  });

  it("follows the first link for the first page", () => {
    expect(pageLinkUrl(bundle, 1, 8, 20)).toBe(`${BASE}/Patient?_count=5&_page=1&_total=accurate`);
  });

  it("follows the last link for the final page", () => {
    expect(pageLinkUrl(bundle, 20, 3, 20)).toBe(
      `${BASE}/Patient?_count=5&_page=20&_total=accurate`,
    );
  });

  it("prefers the next link over the last link when both could apply", () => {
    const twoPages: BundleLike = {
      resourceType: "Bundle",
      link: [
        { relation: "next", url: `${BASE}/Patient?_count=5&_page=2&_total=accurate` },
        { relation: "last", url: `${BASE}/Patient?_count=5&_page=2&_total=accurate&from=last` },
      ],
    };
    expect(pageLinkUrl(twoPages, 2, 1, 2)).toBe(`${BASE}/Patient?_count=5&_page=2&_total=accurate`);
  });

  it("rewrites the self link page for a page with no relation link", () => {
    expect(pageLinkUrl(bundle, 12, 3, 20)).toBe(
      `${BASE}/Patient?_count=5&_page=12&_total=accurate`,
    );
  });

  it("rewrites the self link page when the matching relation link is absent", () => {
    const partial: BundleLike = {
      resourceType: "Bundle",
      link: [{ relation: "self", url: `${BASE}/Patient?_count=5&_page=3&_total=accurate` }],
    };
    expect(pageLinkUrl(partial, 2, 3, 20)).toBe(`${BASE}/Patient?_count=5&_page=2&_total=accurate`);
  });

  it("returns nothing for the page already shown", () => {
    expect(pageLinkUrl(bundle, 3, 3, 20)).toBeUndefined();
  });

  it("returns nothing for targets outside the page range", () => {
    expect(pageLinkUrl(bundle, 0, 3, 20)).toBeUndefined();
    expect(pageLinkUrl(bundle, 21, 3, 20)).toBeUndefined();
  });

  it("returns nothing when the bundle has no pagination links", () => {
    expect(pageLinkUrl({ resourceType: "Bundle" }, 2, 1, 20)).toBeUndefined();
    expect(
      pageLinkUrl(
        { resourceType: "Bundle", link: [{ relation: "self", url: `${BASE}/Patient` }] },
        2,
        1,
        20,
      ),
    ).toBeUndefined();
  });
});

describe("pageNumbers", () => {
  it("lists every page when there are at most seven", () => {
    expect(pageNumbers(1, 1)).toEqual([1]);
    expect(pageNumbers(4, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageNumbers(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("pins the start of the range near the first page", () => {
    expect(pageNumbers(2, 20)).toEqual([1, 2, 3, 4, 5, "…", 20]);
    expect(pageNumbers(4, 20)).toEqual([1, 2, 3, 4, 5, "…", 20]);
  });

  it("pins the end of the range near the last page", () => {
    expect(pageNumbers(18, 20)).toEqual([1, "…", 16, 17, 18, 19, 20]);
    expect(pageNumbers(20, 20)).toEqual([1, "…", 16, 17, 18, 19, 20]);
  });

  it("centres the range around the current page in the middle", () => {
    expect(pageNumbers(10, 20)).toEqual([1, "…", 9, 10, 11, "…", 20]);
  });
});
