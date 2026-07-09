"use client";

import type {
  PipelineStage,
  StageStatus,
} from "@/app/api/patients/[id]/pipeline/route";
import type { OpsPatient } from "@/app/api/patients/route";
import {
  Activity,
  Check,
  ClipboardCheck,
  FileQuestion,
  HeartPulse,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Sparkles,
  Stethoscope,
  UserRoundCheck,
} from "lucide-react";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 4_000;

const stageIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "vitals-ingested": HeartPulse,
  "ml-risk-scoring": Activity,
  "questionnaire-drafted": FileQuestion,
  "sent-via-whatsapp": MessageCircle,
  "patient-responds": MessagesSquare,
  "agentic-risk-assessment": Sparkles,
  "task-created": ClipboardCheck,
  "clinician-review": UserRoundCheck,
};

function formatTime(timestamp: string | undefined): string | undefined {
  if (!timestamp) return undefined;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const nodeRing: Record<StageStatus, string> = {
  pending: "border-border bg-muted/30 text-muted-foreground/70",
  active:
    "border-sky-500 bg-sky-500 text-white shadow-[0_0_0_6px_rgba(14,165,233,0.18)] animate-pipeline-pulse",
  done: "border-emerald-500 bg-emerald-500 text-white",
};

function statusLabel(stage: PipelineStage): string {
  if (!stage.observable) return "Not observable";
  if (stage.inferred && stage.status !== "pending") return "Inferred";
  if (stage.status === "done") return "Done";
  if (stage.status === "active") return "In progress";
  return "Pending";
}

function statusTextClasses(stage: PipelineStage): string {
  if (!stage.observable) return "text-muted-foreground/60";
  if (stage.inferred && stage.status !== "pending") return "text-amber-600 dark:text-amber-400";
  if (stage.status === "done") return "text-emerald-600 dark:text-emerald-400";
  if (stage.status === "active") return "text-sky-600 dark:text-sky-400";
  return "text-muted-foreground";
}

function StageIcon({ stage, active }: { stage: PipelineStage; active: boolean }) {
  const Icon = stageIcons[stage.key] ?? Stethoscope;
  const isUnobservable = !stage.observable;
  const isInferred = stage.inferred && stage.status !== "pending";

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
        active ? "size-11" : "size-8",
        isUnobservable
          ? "border-dashed border-border/60 bg-transparent text-muted-foreground/40 opacity-60"
          : isInferred
            ? "border-amber-500 border-dashed bg-amber-500/10 text-amber-600 dark:text-amber-400"
            : nodeRing[stage.status],
      )}
    >
      {stage.status === "done" && !isUnobservable ? (
        <Check className={active ? "size-5" : "size-4"} />
      ) : stage.status === "active" && !isUnobservable ? (
        <Loader2 className={cn("animate-spin", active ? "size-5" : "size-4")} />
      ) : (
        <Icon className={active ? "size-5" : "size-4"} />
      )}
      {isInferred ? (
        <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full border border-background bg-amber-500 text-[7px] font-bold text-white">
          i
        </span>
      ) : null}
    </span>
  );
}

function Connector({ fromStatus, toStatus }: { fromStatus: StageStatus; toStatus: StageStatus }) {
  const isFilled = fromStatus === "done";
  const isFlowing = fromStatus === "done" && toStatus === "active";

  return (
    <div className="relative w-[3px] flex-1 overflow-hidden rounded-full bg-border/70">
      <div
        className={cn(
          "absolute inset-x-0 top-0 rounded-full bg-emerald-500 transition-[height] duration-700 ease-out",
          isFilled ? "h-full" : "h-0",
        )}
      />
      {isFlowing ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-sky-400 to-transparent animate-pipeline-flow-vertical" />
          <div className="absolute left-1/2 size-2 -translate-x-1/2 rounded-full bg-sky-500 shadow-[0_0_8px_2px_rgba(14,165,233,0.7)] animate-pipeline-travel-vertical" />
        </>
      ) : null}
    </div>
  );
}

function StageDetail({ stage }: { stage: PipelineStage }) {
  const time = formatTime(stage.timestamp);

  if (!stage.observable) {
    return <span className="italic text-muted-foreground/70">Not observable from this dashboard</span>;
  }
  if (stage.detail) {
    return (
      <span className="rounded-md bg-muted/50 px-2 py-0.5 leading-snug ring-1 ring-border/60">
        {stage.detail}
        {time ? <span className="ml-1.5 text-muted-foreground/70">· {time}</span> : null}
      </span>
    );
  }
  if (stage.status === "active") {
    return <span className="text-sky-600 dark:text-sky-400">Watching for signal…</span>;
  }
  return <span className="text-muted-foreground/60">Awaiting upstream stage</span>;
}

function PipelineRow({
  stage,
  isLast,
  nextStatus,
}: {
  stage: PipelineStage;
  isLast: boolean;
  nextStatus: StageStatus;
}) {
  const isActive = stage.status === "active" && stage.observable;

  return (
    <div
      className={cn(
        "group flex flex-1 gap-4 rounded-xl px-2 transition-colors",
        isActive && "bg-sky-500/[0.06]",
      )}
    >
      <div className="flex flex-col items-center pt-0.5">
        <StageIcon stage={stage} active={isActive} />
        {!isLast ? <Connector fromStatus={stage.status} toStatus={nextStatus} /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cn("font-semibold", isActive ? "text-base" : "text-sm")}>
            {stage.label}
          </span>
          <span className={cn("text-[11px] font-medium", statusTextClasses(stage))}>
            {statusLabel(stage)}
          </span>
          <span className="text-[11px] text-muted-foreground/60">{stage.service}</span>
        </div>
        <div className="truncate text-xs">
          <StageDetail stage={stage} />
        </div>
      </div>
    </div>
  );
}

export function PipelineView({ patient }: { patient: OpsPatient }) {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    async function poll() {
      try {
        const response = await fetch(`/api/patients/${patient.id}/pipeline`);
        const data = (await response.json()) as { stages: PipelineStage[] };
        if (!cancelled) setStages(data.stages);
      } catch (error) {
        console.error("failed to poll pipeline state", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [patient.id]);

  async function generateQuestionnaire() {
    setSending(true);
    try {
      const response = await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId: patient.id }),
      });
      if (response.ok) {
        toast.success(`Questionnaire request sent for ${patient.name}`, {
          description:
            "care-loop-ai-service POST /questionnaires — fire-and-forget, the pipeline below observes the real result.",
        });
      } else {
        toast.error("Failed to send questionnaire request");
      }
    } catch (error) {
      console.error("failed to trigger questionnaire generation", error);
      toast.error("Failed to send questionnaire request");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{patient.name}</h2>
          <p className="text-sm text-muted-foreground">
            {patient.id}
            {patient.gender ? ` · ${patient.gender}` : ""}
            {patient.birthDate ? ` · ${patient.birthDate}` : ""}
          </p>
        </div>
        <Button onClick={generateQuestionnaire} disabled={sending} variant="outline" size="sm">
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileQuestion className="size-4" />
          )}
          Trigger questionnaire (demo)
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-border/70 bg-[linear-gradient(180deg,var(--color-card)_0%,color-mix(in_oklch,var(--color-muted)_35%,var(--color-card))_100%)] p-4 shadow-sm">
        {!loaded ? (
          <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading pipeline state…
          </p>
        ) : (
          <div className="flex flex-1 flex-col">
            {stages.map((stage, index) => (
              <PipelineRow
                key={stage.key}
                stage={stage}
                isLast={index === stages.length - 1}
                nextStatus={stages[index + 1]?.status ?? "pending"}
              />
            ))}
          </div>
        )}
      </div>

      <p className="flex-shrink-0 text-center text-[11px] text-muted-foreground">
        Live-polled every {POLL_INTERVAL_MS / 1000}s from care-loop-fhir-server, ehr-fhir-server, and
        whatsapp-simulator. This view is purely observational — the pipeline runs on its own.
      </p>
    </div>
  );
}
