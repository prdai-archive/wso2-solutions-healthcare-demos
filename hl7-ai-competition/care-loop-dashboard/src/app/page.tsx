"use client";

import type { OpsPatient } from "@/app/api/patients/route";
import type { Run } from "@/lib/runs";

import { FileQuestion, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PatientRoster } from "@/components/patient-roster";
import { IncomingHitsTicker } from "@/components/pipeline/incoming-hits-ticker";
import { MetricsRow } from "@/components/pipeline/metrics-row";
import { PipelineCanvas } from "@/components/pipeline/pipeline-canvas";
import { RunPicker } from "@/components/pipeline/run-picker";
import { StageDetailPanel } from "@/components/pipeline/stage-detail-panel";
import { RequestLogPanel } from "@/components/request-log-panel";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 4_000;

function furthestReachedIndex(run: Run): number {
  let last = -1;
  run.stages.forEach((s, i) => {
    if (s.status === "done" || s.status === "active") last = i;
  });
  return Math.max(0, last);
}

export default function DashboardPage() {
  const [selected, setSelected] = useState<OpsPatient | undefined>(undefined);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined);
  const [selectedIndex, setSelectedIndex] = useState<number | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const prevPatientIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/patients/${selected!.id}/runs`);
        const data = (await response.json()) as { runs: Run[] };
        if (!cancelled) {
          setRuns(data.runs);
          setRunsLoaded(true);
        }
      } catch (error) {
        console.error("failed to poll patient runs", error);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selected]);

  // Default to the latest run and its furthest-reached stage, but only when
  // switching patient/run - not on every 4s refresh of the same run, so a
  // manual node click sticks around while data keeps flowing in.
  useEffect(() => {
    if (runs.length === 0) return;
    const patientChanged = prevPatientIdRef.current !== selected?.id;
    prevPatientIdRef.current = selected?.id;

    const stillExists = runs.some((r) => r.id === selectedRunId);
    if (patientChanged || !stillExists) {
      // segmentRuns returns newest-first.
      const latest = runs[0]!;
      setSelectedRunId(latest.id);
      setSelectedIndex(furthestReachedIndex(latest));
    }
  }, [runs, selected?.id, selectedRunId]);

  const activeRun = runs.find((r) => r.id === selectedRunId) ?? runs[0];

  function selectRun(id: string) {
    setSelectedRunId(id);
    const run = runs.find((r) => r.id === id);
    if (run) setSelectedIndex(furthestReachedIndex(run));
  }

  async function generateQuestionnaire() {
    if (!selected) return;
    setSending(true);
    try {
      const response = await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId: selected.id }),
      });
      if (response.ok) {
        toast.success(`Questionnaire request sent for ${selected.name}`, {
          description: "care-loop-ai-service POST /questionnaires — fire-and-forget.",
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-[21px] font-bold tracking-tight">Pipeline monitor</h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Observing <strong className="font-semibold text-foreground/80">fire-and-forget hits</strong> from
            Care Loop services — each stage is an inbound request the dashboard logs (202 Accepted, no
            response awaited). Drag the canvas to pan, click a node to inspect its payload.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-muted-foreground">
            <span className="size-1.5 animate-canvas-soft-pulse rounded-full bg-foreground" />
            Live · polling every {POLL_INTERVAL_MS / 1000}s
          </span>
          <Button onClick={generateQuestionnaire} disabled={!selected || sending} variant="outline" size="sm">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <FileQuestion className="size-4" />}
            Trigger questionnaire (demo)
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[252px_minmax(0,1fr)]">
        <div className="min-h-[240px] lg:min-h-0">
          <PatientRoster selectedId={selected?.id} onSelect={setSelected} />
        </div>

        <div className="min-h-0">
          {!selected || !runsLoaded ? (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              {selected ? "Loading pipeline history…" : "Select a patient to watch their pipeline."}
            </div>
          ) : !activeRun ? (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
              No events received yet for {selected.name}.
              <br />
              The pipeline hasn't run for this patient yet.
            </div>
          ) : (
            <>
              <MetricsRow run={activeRun} />
              <RunPicker runs={runs} selectedRunId={activeRun.id} onSelectRunId={selectRun} />
              <PipelineCanvas
                run={activeRun}
                selectedIndex={selectedIndex ?? furthestReachedIndex(activeRun)}
                onSelectIndex={setSelectedIndex}
              />

              <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
                <StageDetailPanel
                  stage={activeRun.stages[selectedIndex ?? furthestReachedIndex(activeRun)]!}
                  index={selectedIndex ?? furthestReachedIndex(activeRun)}
                />
                <IncomingHitsTicker />
              </div>
            </>
          )}
        </div>
      </div>

      <RequestLogPanel />
    </div>
  );
}
