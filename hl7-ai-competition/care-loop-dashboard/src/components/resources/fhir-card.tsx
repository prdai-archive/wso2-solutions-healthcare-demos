"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ViewMode = "card" | "raw";

export function FhirCard({
  title,
  subtitle,
  badge,
  raw,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  raw: unknown;
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<ViewMode>("card");

  return (
    <Card size="sm">
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
        <div className="flex shrink-0 items-center gap-0.5 self-start rounded-lg bg-foreground/5 p-0.5">
          <button
            type="button"
            onClick={() => setMode("card")}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              mode === "card"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Card
          </button>
          <button
            type="button"
            onClick={() => setMode("raw")}
            className={cn(
              "rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
              mode === "raw"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Raw FHIR
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {mode === "card" ? (
          children
        ) : (
          <pre className="max-h-64 overflow-auto rounded-lg bg-foreground/[0.04] p-2.5 font-mono text-[11px] leading-relaxed text-foreground/80">
            {JSON.stringify(raw, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
