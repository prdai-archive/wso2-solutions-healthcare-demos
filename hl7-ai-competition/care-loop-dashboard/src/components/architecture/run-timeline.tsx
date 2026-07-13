"use client";

import type { Run, RunStage } from "@/lib/runs";

import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Loader2,
  MessageSquare,
  Send,
  Smartphone,
  Stethoscope,
} from "lucide-react";
import { useState } from "react";

import { STAGE_DEFS } from "@/lib/stages";
import { cn } from "@/lib/utils";

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  vitals: Smartphone,
  ml: Cpu,
  escalation: ClipboardCheck,
  quest: MessageSquare,
  sent: Send,
  respond: MessageSquare,
  agentic_draft: BrainCircuit,
  agentic: BrainCircuit,
  task_desc: ClipboardCheck,
  fhir: ClipboardCheck,
  clinician: Stethoscope,
};

const STATUS_LABEL: Record<RunStage["status"], string> = {
  done: "Received",
  active: "Processing",
  pending: "Pending",
  "not-observable": "Not observable",
};

function formatRunLabel(run: Run): string {
  return new Date(run.startedAt).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Horizontal step-timeline for a single run's real stage data (same
// STAGE_DEFS/RunStage source ArchitectureView uses) - hover a step to inspect
// its real event payload instead of click-to-select on a free-form canvas.
export function RunTimeline({ run }: { run: Run }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const hoveredStage = hovered ? run.stages.find((s) => s.key === hovered) : null;
  const hoveredIndex = hoveredStage ? STAGE_DEFS.findIndex((def) => def.key === hoveredStage.key) : -1;
  const hoveredDef = hoveredIndex >= 0 ? STAGE_DEFS[hoveredIndex] : null;

  const rows: { key: string; value: string }[] = [];
  if (hoveredStage?.event?.detail) rows.push({ key: "detail", value: hoveredStage.event.detail });
  if (hoveredStage?.event?.payload) {
    for (const [key, value] of Object.entries(hoveredStage.event.payload)) rows.push({ key, value });
  }
  if (hoveredStage?.status === "not-observable") {
    rows.push({ key: "note", value: "This handoff happens outside care-loop-dashboard." });
  }
  if (hoveredStage?.event) {
    rows.push({ key: "received_at", value: new Date(hoveredStage.event.receivedAt).toLocaleTimeString() });
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border canvas-dotted-grid bg-muted/20 shadow-inner">
      <span className="absolute top-3 left-3 z-10 rounded-full border border-border bg-background/90 px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground">
        Latest run
      </span>
      <span className="absolute top-3 right-3 z-10 font-mono text-[10px] text-muted-foreground/60">
        {formatRunLabel(run)} · {run.outcome}
      </span>

      <div className="overflow-x-auto p-6 pt-14">
        <div className="flex min-w-max items-center">
          {run.stages.map((stage, index) => {
            const def = STAGE_DEFS[index]!;
            const Icon = STAGE_ICONS[stage.key] ?? Cpu;
            const isDone = stage.status === "done";
            const isActive = stage.status === "active";
            const isLast = index === run.stages.length - 1;

            return (
              <div key={stage.key} className="flex items-center">
                <button
                  type="button"
                  onMouseEnter={() => setHovered(stage.key)}
                  onMouseLeave={() => setHovered((current) => (current === stage.key ? null : current))}
                  className="flex w-[150px] flex-col items-center gap-2 text-center"
                >
                  <div
                    className={cn(
                      "relative flex size-11 items-center justify-center rounded-full border transition-all",
                      isDone && "border-foreground bg-foreground text-background",
                      isActive && "border-foreground/70 bg-background text-foreground animate-canvas-node-pulse",
                      stage.status === "pending" && "border-border bg-background text-muted-foreground/60",
                      stage.status === "not-observable" && "border-dashed border-border text-muted-foreground/40",
                      hovered === stage.key && "ring-2 ring-foreground/30 ring-offset-2 ring-offset-background",
                    )}
                  >
                    {isDone ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
                    {isActive ? (
                      <span className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full border border-foreground bg-background">
                        <Loader2 className="size-2.5 animate-spin" />
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11.5px] font-semibold leading-tight">{def.label}</div>
                  <div className="truncate font-mono text-[9px] text-muted-foreground/60">{def.service}</div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[9.5px] font-semibold",
                      isDone && "bg-foreground/10 text-foreground/70",
                      isActive && "bg-foreground text-background",
                      (stage.status === "pending" || stage.status === "not-observable") &&
                        "border border-border text-muted-foreground",
                    )}
                  >
                    {STATUS_LABEL[stage.status]}
                  </span>
                </button>
                {!isLast ? (
                  <span className="relative mx-1 flex h-4 w-8 shrink-0 items-center overflow-hidden">
                    <ArrowRight className="size-4 text-muted-foreground/40" />
                    {isDone ? (
                      <span className="absolute top-1/2 left-0 size-1 -translate-y-1/2 rounded-full bg-foreground/50 animate-canvas-flow-dot-h" />
                    ) : null}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {hoveredStage && hoveredDef ? (
        <div className="animate-canvas-fade-up absolute top-14 left-1/2 z-20 w-[320px] -translate-x-1/2 rounded-2xl border border-border bg-background p-4 shadow-[0_20px_50px_rgba(0,0,0,0.15)]">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[13px] font-bold tracking-tight">{hoveredDef.label}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                hoveredStage.status === "done" && "bg-foreground/10 text-foreground/70",
                hoveredStage.status === "active" && "bg-foreground text-background",
                (hoveredStage.status === "pending" || hoveredStage.status === "not-observable") &&
                  "border border-border text-muted-foreground",
              )}
            >
              {STATUS_LABEL[hoveredStage.status]}
            </span>
          </div>
          <div className="mb-3 border-b border-border/60 pb-2 font-mono text-[10.5px] text-muted-foreground">
            {hoveredDef.method} {hoveredDef.endpoint}
          </div>
          {rows.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Awaiting upstream stage - nothing received yet.</p>
          ) : (
            <div className="flex flex-col">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between gap-3 border-t border-border/40 py-1.5 first:border-t-0"
                >
                  <span className="font-mono text-[10.5px] text-muted-foreground">{row.key}</span>
                  <span className="truncate text-right font-mono text-[10.5px] text-foreground">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
