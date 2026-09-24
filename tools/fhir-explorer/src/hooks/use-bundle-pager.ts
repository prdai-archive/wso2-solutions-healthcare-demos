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

import { useRef, useState } from "react";

import { pageLinkUrl, pageNumbers } from "@/lib/fhir-pagination";
import type { BundleLike } from "@/lib/fhir-types";

interface BundlePagerOptions {
  load: (url: string) => Promise<unknown> | void;
  onNavigate?: () => void;
}

export interface BundlePager {
  page: number;
  total: number;
  entries: NonNullable<BundleLike["entry"]>;
  numbers: Array<number | "…">;
  rangeStart: number;
  rangeEnd: number;
  showReload: boolean;
  showFirst: boolean;
  showLast: boolean;
  canFirst: boolean;
  canLast: boolean;
  canPrevious: boolean;
  canNext: boolean;
  goToPage: (target: number) => void;
  goFirst: () => void;
  goLast: () => void;
  goPrevious: () => void;
  goNext: () => void;
  reload: () => void;
  reset: () => void;
}

/**
 * Page state and navigation for a FHIR searchset Bundle: server-paged bundles
 * navigate by link, bundles that arrived whole are sliced locally.
 */
export function useBundlePager(
  bundle: BundleLike | undefined,
  pageSize: number,
  { load, onNavigate }: BundlePagerOptions,
): BundlePager {
  const [requestedPage, setRequestedPage] = useState(1);
  const pending = useRef(false);
  const bundleEntries = bundle?.entry ?? [];
  const total = typeof bundle?.total === "number" ? bundle.total : bundleEntries.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const serverPaged = total > bundleEntries.length && bundleEntries.length <= pageSize;
  const entries = serverPaged
    ? bundleEntries
    : bundleEntries.slice((page - 1) * pageSize, page * pageSize);

  function hasLink(relation: string): boolean {
    return Boolean(bundle?.link?.some((link) => link.relation === relation));
  }

  function canNavigateTo(target: number): boolean {
    return !serverPaged || Boolean(pageLinkUrl(bundle, target, page, totalPages));
  }

  function goToPage(target: number) {
    const next = Math.max(1, Math.min(target, totalPages));
    if (next === page) return;
    if (serverPaged) {
      if (pending.current) return;
      const url = pageLinkUrl(bundle, next, page, totalPages);
      if (!url) return;
      pending.current = true;
      void Promise.resolve(load(url)).finally(() => {
        pending.current = false;
      });
    }
    setRequestedPage(next);
    onNavigate?.();
  }

  function reload() {
    const self = bundle?.link?.find((link) => link.relation === "self")?.url;
    if (!self) return;
    load(self);
    onNavigate?.();
  }

  return {
    page,
    total,
    entries,
    numbers: pageNumbers(page, totalPages),
    rangeStart: total ? (page - 1) * pageSize + 1 : 0,
    rangeEnd: (page - 1) * pageSize + entries.length,
    showReload: hasLink("self"),
    showFirst: hasLink("first") || (serverPaged && page > 1 && canNavigateTo(1)),
    showLast: hasLink("last") || (serverPaged && page < totalPages && canNavigateTo(totalPages)),
    canFirst: page > 1 && canNavigateTo(1),
    canLast: page < totalPages && canNavigateTo(totalPages),
    canPrevious: page > 1 && canNavigateTo(page - 1),
    canNext: page < totalPages && canNavigateTo(page + 1),
    goToPage,
    goFirst: () => goToPage(1),
    goLast: () => goToPage(totalPages),
    goPrevious: () => goToPage(page - 1),
    goNext: () => goToPage(page + 1),
    reload,
    reset: () => setRequestedPage(1),
  };
}
