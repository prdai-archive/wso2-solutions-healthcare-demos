"use client";

import type { ArchitectureBoxDef } from "@/lib/architecture";
import type { Run, StageStatus } from "@/lib/runs";

import {
  ArrowRight,
  BrainCircuit,
  ClipboardCheck,
  Cpu,
  Database,
  FileText,
  Loader2,
  MessageSquare,
  Smartphone,
  Stethoscope,
  User,
} from "lucide-react";

import { ArchitectureDetailPanel } from "@/components/architecture/architecture-detail-panel";
import { ARCHITECTURE_BOXES } from "@/lib/architecture";
import { cn } from "@/lib/utils";

type BoxStatus = "done" | "active" | "pending";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "apple-health": Smartphone,
  "whatsapp-agent": MessageSquare,
  "ml-model": Cpu,
  "deterministic-rules": ClipboardCheck,
  "clinical-analysis-agent": BrainCircuit,
  "fhir-converter": FileText,
  "notification-ehr-integration": ClipboardCheck,
  "front-desk": Stethoscope,
  patient: User,
  ehr: Database,
  doctor: User,
};

function boxOf(key: string): ArchitectureBoxDef {
  return ARCHITECTURE_BOXES.find((b) => b.key === key)!;
}

function statusOf(box: ArchitectureBoxDef, run: Run): BoxStatus {
  if (box.stageKeys.length === 0) return "pending";
  const statuses: StageStatus[] = box.stageKeys.map(
    (key) => run.stages.find((s) => s.key === key)?.status ?? "pending",
  );
  if (statuses.every((s) => s === "done")) return "done";
  const anyActive = statuses.includes("active");
  const anyPending = statuses.some((s) => s === "pending" || s === "not-observable");
  if (anyActive && !anyPending) return "active";
  return "pending";
}

function ActorBox({ boxKey, className }: { boxKey: string; className?: string }) {
  const box = boxOf(boxKey);
  const Icon = ICONS[boxKey] ?? User;
  return (
    <div
      className={cn(
        "flex w-[128px] flex-col items-center gap-1.5 rounded-2xl border border-dashed border-border/70 bg-muted/30 p-3 text-center",
        className,
      )}
    >
      <div className="flex size-8 items-center justify-center rounded-[9px] border border-border text-muted-foreground/70">
        <Icon className="size-4" />
      </div>
      <div className="text-[12.5px] font-semibold text-muted-foreground">{box.label}</div>
    </div>
  );
}

function PipelineBox({
  boxKey,
  run,
  selected,
  onSelect,
  className,
}: {
  boxKey: string;
  run: Run;
  selected: boolean;
  onSelect: (key: string) => void;
  className?: string;
}) {
  const box = boxOf(boxKey);
  const status = statusOf(box, run);
  const Icon = ICONS[boxKey] ?? Cpu;
  const isDone = status === "done";
  const isActive = status === "active";

  return (
    <button
      type="button"
      onClick={() => onSelect(boxKey)}
      className={cn(
        "flex w-[190px] flex-col rounded-2xl border bg-background p-3.5 text-left transition-[border-color,box-shadow]",
        isDone && "border-border/80",
        isActive && "border-foreground/60 animate-canvas-node-pulse",
        status === "pending" && "border-border/80",
        selected &&
          (isActive
            ? "border-foreground shadow-[0_0_0_3px_var(--border),0_10px_26px_rgba(0,0,0,0.12)]"
            : "border-foreground/50 shadow-[0_0_0_3px_var(--border),0_10px_26px_rgba(0,0,0,0.12)]"),
        !selected && !isActive && "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_22px_rgba(0,0,0,0.05)]",
        "hover:border-foreground/40",
        className,
      )}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-[9px] transition-all",
            isDone && "bg-foreground text-background",
            isActive && "border-[1.5px] border-foreground bg-background text-foreground",
            status === "pending" && "border border-border bg-foreground/5 text-muted-foreground/70",
          )}
        >
          <Icon className="size-4" />
        </div>
        {isActive ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : null}
      </div>
      <div className={cn("text-[12.5px] font-semibold leading-tight", status === "pending" && "text-muted-foreground")}>
        {box.label}
      </div>
      {box.sublabel ? (
        <div className="mt-1 truncate text-[10.5px] text-muted-foreground/70">{box.sublabel}</div>
      ) : null}
      <div className="mt-2 text-[11px] font-semibold text-muted-foreground/70">
        {isDone ? "Received" : isActive ? "Processing" : "Pending"}
      </div>
    </button>
  );
}

function FlowArrow({ label }: { label?: string }) {
  return (
    <div className="flex shrink-0 flex-col items-center justify-center gap-1 px-1.5">
      {label ? <span className="text-[10px] text-muted-foreground/60">{label}</span> : null}
      <ArrowRight className="size-4 text-muted-foreground/40" />
    </div>
  );
}

export function ArchitectureView({
  run,
  selectedBoxKey,
  onSelectBox,
}: {
  run: Run;
  selectedBoxKey: string | null;
  onSelectBox: (key: string) => void;
}) {
  const decisionEngineKeys = ["ml-model", "deterministic-rules", "clinical-analysis-agent"];
  const decisionEngineStatus: BoxStatus = decisionEngineKeys
    .map((k) => statusOf(boxOf(k), run))
    .includes("active")
    ? "active"
    : decisionEngineKeys.every((k) => statusOf(boxOf(k), run) === "done")
      ? "done"
      : "pending";

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto rounded-2xl border border-border bg-muted/40 p-6 shadow-inner">
        <div className="flex min-w-max items-center gap-0">
          <ActorBox boxKey="patient" />
          <FlowArrow />

          <div className="flex flex-col gap-3">
            <PipelineBox boxKey="apple-health" run={run} selected={selectedBoxKey === "apple-health"} onSelect={onSelectBox} />
            <PipelineBox boxKey="whatsapp-agent" run={run} selected={selectedBoxKey === "whatsapp-agent"} onSelect={onSelectBox} />
          </div>
          <FlowArrow label="Predict / Evaluate" />

          <div
            className={cn(
              "flex flex-col gap-3 rounded-2xl border-2 border-dashed p-4",
              decisionEngineStatus === "done" && "border-foreground/40 bg-foreground/[0.03]",
              decisionEngineStatus === "active" && "border-foreground/60 bg-foreground/[0.03]",
              decisionEngineStatus === "pending" && "border-border/70",
            )}
          >
            <span className="text-[10.5px] font-bold tracking-wide text-muted-foreground uppercase">
              Decision Engine
            </span>
            <div className="flex flex-col gap-3">
              <PipelineBox boxKey="ml-model" run={run} selected={selectedBoxKey === "ml-model"} onSelect={onSelectBox} className="w-[176px]" />
              <PipelineBox
                boxKey="clinical-analysis-agent"
                run={run}
                selected={selectedBoxKey === "clinical-analysis-agent"}
                onSelect={onSelectBox}
                className="w-[176px]"
              />
              <PipelineBox
                boxKey="deterministic-rules"
                run={run}
                selected={selectedBoxKey === "deterministic-rules"}
                onSelect={onSelectBox}
                className="w-[176px]"
              />
            </div>
          </div>
          <FlowArrow label="Upon Alert" />

          <PipelineBox boxKey="fhir-converter" run={run} selected={selectedBoxKey === "fhir-converter"} onSelect={onSelectBox} />
          <FlowArrow />

          <PipelineBox
            boxKey="notification-ehr-integration"
            run={run}
            selected={selectedBoxKey === "notification-ehr-integration"}
            onSelect={onSelectBox}
            className="w-[210px]"
          />
          <FlowArrow />

          <PipelineBox boxKey="front-desk" run={run} selected={selectedBoxKey === "front-desk"} onSelect={onSelectBox} />
          <FlowArrow label="Notify" />

          <div className="flex flex-col gap-3">
            <ActorBox boxKey="doctor" />
            <ActorBox boxKey="ehr" />
          </div>
        </div>
      </div>

      {selectedBoxKey ? <ArchitectureDetailPanel box={boxOf(selectedBoxKey)} run={run} /> : null}
    </div>
  );
}
