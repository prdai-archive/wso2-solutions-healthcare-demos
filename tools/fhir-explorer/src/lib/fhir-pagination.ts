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

import type { BundleLike } from "./fhir-types";

function linkUrl(bundle: BundleLike | undefined, relation: string): string | undefined {
  return bundle?.link?.find((link) => link.relation === relation)?.url;
}

function selfPageUrl(bundle: BundleLike | undefined, page: number): string | undefined {
  const self = linkUrl(bundle, "self");
  if (!self || !/[?&]_page=\d+/.test(self)) return undefined;
  return self.replace(/([?&]_page=)\d+/, `$1${page}`);
}

/** Relation links first; pages with none are addressed by rewriting `_page` on the self link (WSO2 FHIR server pagination). */
export function pageLinkUrl(
  bundle: BundleLike | undefined,
  target: number,
  current: number,
  total: number,
): string | undefined {
  if (target < 1 || target > total || target === current) return undefined;
  const relation =
    target === current + 1
      ? "next"
      : target === current - 1
        ? "previous"
        : target === 1
          ? "first"
          : target === total
            ? "last"
            : undefined;
  if (relation) return linkUrl(bundle, relation) ?? selfPageUrl(bundle, target);
  return selfPageUrl(bundle, target);
}
