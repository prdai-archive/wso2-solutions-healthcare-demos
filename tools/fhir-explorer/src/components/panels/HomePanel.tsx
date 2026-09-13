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

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DemoCta, DemoIntro, DemoWarning } from "@/components/DemoNotice";

export function HomePanel() {
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary">
          WSO2 Open Healthcare
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          Open Healthcare FHIR Explorer
        </h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Explore a public FHIR R4 server — no setup, no account.
        </p>
      </header>

      <DemoIntro />
      <DemoWarning />
      <DemoCta />

      <p className="text-sm">
        <Link
          href="/about"
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          Full demo notice
          <ArrowRight className="size-3.5" />
        </Link>
      </p>
    </div>
  );
}
