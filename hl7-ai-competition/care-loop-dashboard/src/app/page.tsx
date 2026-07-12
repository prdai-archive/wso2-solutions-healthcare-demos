"use client";

import type { OpsPatient } from "@/app/api/patients/route";
import type { Run } from "@/lib/runs";

import { FileQuestion, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AlertsList } from "@/components/alerts/alerts-list";
import { ArchitectureView } from "@/components/architecture/architecture-view";
import { PatientRoster } from "@/components/patient-roster";
import { RunPicker } from "@/components/pipeline/run-picker";
import { RequestLogPanel } from "@/components/request-log-panel";
import { AgenticPredictionsList } from "@/components/resources/agentic-predictions-list";
import { MlPredictionsList } from "@/components/resources/ml-predictions-list";
import { ObservationsList } from "@/components/resources/observations-list";
import { PatientHistory } from "@/components/resources/patient-history";
import { QuestionnaireResponsesList } from "@/components/resources/questionnaire-responses-list";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 4_000;

export default function DashboardPage() {
  const [selected, setSelected] = useState<OpsPatient | undefined>(undefined);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined);
  const [selectedBoxKey, setSelectedBoxKey] = useState<string | null>(null);
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

  // Default to the latest run only on patient or run switch, not on every 4s refresh, so a manual box click sticks around while data keeps flowing in.
  useEffect(() => {
    if (runs.length === 0) return;
    const patientChanged = prevPatientIdRef.current !== selected?.id;
    prevPatientIdRef.current = selected?.id;

    const stillExists = runs.some((r) => r.id === selectedRunId);
    if (patientChanged || !stillExists) {
      // segmentRuns returns newest-first.
      const latest = runs[0]!;
      setSelectedRunId(latest.id);
      setSelectedBoxKey(null);
    }
  }, [runs, selected?.id, selectedRunId]);

  const activeRun = runs.find((r) => r.id === selectedRunId) ?? runs[0];

  function selectRun(id: string) {
    setSelectedRunId(id);
    setSelectedBoxKey(null);
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
          <h1 className="text-[21px] font-bold tracking-tight">Care Loop Patient Dashboard</h1>
          <p className="max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Select a patient to see their <strong className="font-semibold text-foreground/80">latest Care Loop
            run</strong> against the architecture, along with their alerts, vitals, questionnaire responses, ML
            and agentic risk predictions, and clinical history. Click a box in the diagram to inspect its payload.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-muted-foreground">
            <span className="size-1.5 shrink-0 animate-canvas-soft-pulse rounded-full bg-foreground" />
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
              {selected ? "Loading patient history…" : "Select a patient to view their dashboard."}
            </div>
          ) : !activeRun ? (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
              No events received yet for {selected.name}.
              <br />
              The pipeline hasn't run for this patient yet.
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div>
                <RunPicker runs={runs} selectedRunId={activeRun.id} onSelectRunId={selectRun} />
                <ArchitectureView
                  run={activeRun}
                  selectedBoxKey={selectedBoxKey}
                  onSelectBox={setSelectedBoxKey}
                />
              </div>

              <div className="rounded-2xl border border-border p-4">
                <h2 className="mb-2 text-[13px] font-semibold">Alerts</h2>
                <AlertsList patientId={selected.id} />
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-border p-4">
                  <h2 className="mb-2 text-[13px] font-semibold">Vitals</h2>
                  <ObservationsList patientId={selected.id} />
                </div>
                <div className="rounded-2xl border border-border p-4">
                  <h2 className="mb-2 text-[13px] font-semibold">Questionnaires</h2>
                  <QuestionnaireResponsesList patientId={selected.id} />
                </div>
                <div className="rounded-2xl border border-border p-4">
                  <h2 className="mb-2 text-[13px] font-semibold">ML predictions</h2>
                  <MlPredictionsList patientId={selected.id} />
                </div>
                <div className="rounded-2xl border border-border p-4">
                  <h2 className="mb-2 text-[13px] font-semibold">Agentic predictions</h2>
                  <AgenticPredictionsList patientId={selected.id} />
                </div>
                <div className="rounded-2xl border border-border p-4 lg:col-span-2">
                  <h2 className="mb-2 text-[13px] font-semibold">History</h2>
                  <PatientHistory patientId={selected.id} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <RequestLogPanel />
    </div>
  );
}
