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

import Image from "next/image";
import { ExternalLink, Github } from "lucide-react";
import { RequestHistoryMenu } from "./RequestHistoryMenu";

export function BaseUrlBar() {
  return (
    <div className="border-b bg-card">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 pr-1">
            <Image src="/icons/fhir-server.svg" alt="" width={20} height={20} priority />
            <span className="font-semibold">FHIR Explorer</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a
              href="https://github.com/wso2/fhir-server"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Github className="size-4" />
              <span>WSO2 FHIR Server</span>
              <ExternalLink className="size-3" />
            </a>
            <RequestHistoryMenu />
          </div>
        </div>
      </div>
    </div>
  );
}
