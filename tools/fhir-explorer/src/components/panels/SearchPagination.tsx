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

import { ChevronsLeft, ChevronsRight, RefreshCw } from "lucide-react";

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import type { BundlePager } from "@/hooks/use-bundle-pager";

const disabled = "pointer-events-none opacity-50";

export function SearchPagination({ pager }: { pager: BundlePager }) {
  return (
    <Pagination className="mx-0 w-auto justify-end">
      <PaginationContent>
        {pager.showReload && (
          <PaginationItem>
            <PaginationLink
              href="#"
              aria-label="Reload current page"
              title="Reload current page"
              onClick={(event) => {
                event.preventDefault();
                pager.reload();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Reload current page</span>
            </PaginationLink>
          </PaginationItem>
        )}
        {pager.showFirst && (
          <PaginationItem>
            <PaginationLink
              href="#"
              aria-label="Go to first page"
              title="First page"
              className={pager.canFirst ? "" : disabled}
              onClick={(event) => {
                event.preventDefault();
                pager.goFirst();
              }}
            >
              <ChevronsLeft className="h-4 w-4" />
              <span className="sr-only">First page</span>
            </PaginationLink>
          </PaginationItem>
        )}
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={!pager.canPrevious}
            className={pager.canPrevious ? "" : disabled}
            onClick={(event) => {
              event.preventDefault();
              pager.goPrevious();
            }}
          />
        </PaginationItem>
        {pager.numbers.map((candidate, index) => (
          <PaginationItem key={`${candidate}-${index}`}>
            {candidate === "…" ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center text-sm text-muted-foreground">
                …
              </span>
            ) : (
              <PaginationLink
                href="#"
                isActive={candidate === pager.page}
                className="h-9 w-9 shrink-0 p-0"
                onClick={(event) => {
                  event.preventDefault();
                  pager.goToPage(candidate);
                }}
              >
                {candidate}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={!pager.canNext}
            className={pager.canNext ? "" : disabled}
            onClick={(event) => {
              event.preventDefault();
              pager.goNext();
            }}
          />
        </PaginationItem>
        {pager.showLast && (
          <PaginationItem>
            <PaginationLink
              href="#"
              aria-label="Go to last page"
              title="Last page"
              className={pager.canLast ? "" : disabled}
              onClick={(event) => {
                event.preventDefault();
                pager.goLast();
              }}
            >
              <ChevronsRight className="h-4 w-4" />
              <span className="sr-only">Last page</span>
            </PaginationLink>
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
