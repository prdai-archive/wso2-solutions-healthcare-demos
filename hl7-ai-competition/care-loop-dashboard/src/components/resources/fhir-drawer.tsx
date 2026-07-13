"use client";

import type { FhirDrawerTarget } from "@/lib/fhir-drawer-context";

import { Braces, X } from "lucide-react";
import { useState } from "react";

import { FhirDrawerContext, useFhirDrawer } from "@/lib/fhir-drawer-context";
import { cn } from "@/lib/utils";

// Shared slide-in drawer so every "{ } FHIR" button across alerts, vitals,
// questionnaires, predictions, and patient-record rows opens the same raw
// resource viewer instead of each list keeping its own inline toggle.
export function FhirDrawerProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<FhirDrawerTarget | null>(null);

  return (
    <FhirDrawerContext value={{ open: setTarget }}>
      {children}
      {target ? (
        <>
          <button
            type="button"
            aria-label="Close FHIR viewer"
            onClick={() => setTarget(null)}
            className="fixed inset-0 z-40 bg-black/30 animate-canvas-fade-up"
          />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] flex-col border-l border-border bg-background shadow-2xl animate-canvas-drawer-in">
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 truncate font-mono text-[12.5px] font-medium">
                <Braces className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{target.resourcePath}</span>
              </div>
              <button
                type="button"
                onClick={() => setTarget(null)}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto bg-foreground/[0.03] p-4 font-mono text-[11.5px] leading-relaxed text-foreground/85">
              {JSON.stringify(target.raw, null, 2)}
            </pre>
          </div>
        </>
      ) : null}
    </FhirDrawerContext>
  );
}

export function FhirButton({
  resourcePath,
  raw,
  className,
}: {
  resourcePath: string;
  raw: unknown;
  className?: string;
}) {
  const { open } = useFhirDrawer();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open({ resourcePath, raw });
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground",
        className,
      )}
    >
      <Braces className="size-3" />
      FHIR
    </button>
  );
}
