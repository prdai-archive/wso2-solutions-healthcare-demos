"use client";

import { FhirButton } from "@/components/resources/fhir-drawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function FhirCard({
  title,
  subtitle,
  badge,
  resourcePath,
  raw,
  highlighted,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  resourcePath: string;
  raw: unknown;
  highlighted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card size="sm" className={cn(highlighted && "border-foreground/50 bg-foreground/[0.03]")}>
      <CardHeader className="has-data-[slot=card-action]:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 flex-col gap-0.5" data-slot="card-action-target">
          <CardTitle className="flex items-center gap-2">
            <span className="truncate">{title}</span>
            {badge ? (
              <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                {badge}
              </span>
            ) : null}
          </CardTitle>
          {subtitle ? (
            <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <FhirButton resourcePath={resourcePath} raw={raw} className="self-start" />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
