"use client";

import type { Run } from "@/lib/runs";

import { cn } from "@/lib/utils";

function formatRunLabel(run: Run): string {
  return new Date(run.startedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const OUTCOME_DOT: Record<string, string> = {
  "Task created": "bg-foreground",
  "Escalated, no Task yet": "border border-foreground/60",
  "Below escalation threshold": "bg-foreground/20",
};

export function RunPicker({
  runs,
  selectedRunId,
  onSelectRunId,
}: {
  runs: Run[];
  selectedRunId: string;
  onSelectRunId: (id: string) => void;
}) {
  if (runs.length === 0) return null;

  return (
    <div className="mb-3.5 flex items-center gap-2 overflow-x-auto pb-1">
      <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
        Runs ({runs.length}) ·
      </span>
      {runs.map((run) => {
        const selected = run.id === selectedRunId;
        return (
          <button
            key={run.id}
            type="button"
            onClick={() => onSelectRunId(run.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
              selected
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:border-foreground/40",
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                selected ? "bg-background" : OUTCOME_DOT[run.outcome] ?? "bg-foreground/20",
              )}
            />
            {formatRunLabel(run)}
            {run.isLatest ? <span className="opacity-60">· latest</span> : null}
          </button>
        );
      })}
    </div>
  );
}
