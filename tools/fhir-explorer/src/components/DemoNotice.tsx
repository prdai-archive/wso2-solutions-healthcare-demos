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

import type { ComponentType, ReactNode } from "react";
import {
  ArrowRight,
  ExternalLink,
  FlaskConical,
  Gauge,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const HEALTHCARE_URL = "https://wso2.com/solutions/healthcare/";
export const FHIR_SERVER_URL = "https://github.com/wso2/fhir-server";
export const CONTACT_URL = "https://wso2.com/contact/?ref=Healthcare";

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 font-medium text-foreground underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
    >
      {children}
      <ExternalLink className="size-3" />
    </a>
  );
}

export function DemoIntro() {
  return (
    <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
      You are accessing the <TextLink href={HEALTHCARE_URL}>WSO2 Open Healthcare</TextLink> FHIR
      Explorer demo site, connected to a public demo{" "}
      <TextLink href={FHIR_SERVER_URL}>WSO2 FHIR server</TextLink> (R4). This server is provided for
      evaluation and testing of the WSO2 FHIR server.
    </p>
  );
}

export function DemoWarning() {
  return (
    <section className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
      <div>
        <p className="font-medium text-destructive">This is not a production server</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Do not create, upload, or store any information containing personal health information,
          patient identifiers, or other confidential data. All resources on this server are publicly
          readable and writable by anyone.
        </p>
      </div>
    </section>
  );
}

export function DemoDetails() {
  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <Fact icon={FlaskConical} title="Synthetic data only">
        The server is reset weekly and reloaded with a fixed set of synthetic test data, so anything
        you create here will be removed without notice.
      </Fact>
      <Fact icon={Gauge} title="Rate limited">
        Capacity is limited, so requests may take a few moments. Limits protect the server from
        abuse; if your requests are throttled, wait a moment before retrying.
      </Fact>
      <Fact icon={RefreshCw} title="Evaluation only">
        Provided to evaluate the WSO2 FHIR server. Availability is not guaranteed and nothing here
        should be treated as durable.
      </Fact>
    </section>
  );
}

export function DemoCta() {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">Looking to run this in production?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          WSO2 offers supported, hosted deployments of Open Healthcare.
        </p>
      </div>
      <Button asChild className="shrink-0">
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">
          Talk to us
          <ArrowRight />
        </a>
      </Button>
    </section>
  );
}

export function DemoNotice() {
  return (
    <div className="space-y-6">
      <DemoIntro />
      <DemoWarning />
      <DemoDetails />
      <DemoCta />
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <TextLink href={HEALTHCARE_URL}>Open Healthcare</TextLink>
        <TextLink href={FHIR_SERVER_URL}>WSO2 FHIR Server</TextLink>
      </p>
    </div>
  );
}

function Fact({
  icon: Icon,
  title,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <p className="text-sm font-medium">{title}</p>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
