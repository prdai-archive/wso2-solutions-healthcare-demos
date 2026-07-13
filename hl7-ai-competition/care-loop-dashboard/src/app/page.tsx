"use client";

import type { TaskSummary } from "@/app/api/patients/[id]/tasks/route";
import type { OpsPatient } from "@/app/api/patients/route";
import type { Run } from "@/lib/runs";

import { ArrowLeft, FileQuestion, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AlertsList } from "@/components/alerts/alerts-list";
import { AppHeader } from "@/components/app-header";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const POLL_INTERVAL_MS = 4_000;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

export default function DashboardPage() {
  const [selected, setSelected] = useState<OpsPatient | undefined>(undefined);
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | undefined>(undefined);
  const [selectedBoxKey, setSelectedBoxKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [focusedTask, setFocusedTask] = useState<TaskSummary | null>(null);
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
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
          setLastPollAt(Date.now());
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

  function selectPatient(patient: OpsPatient) {
    setSelected(patient);
    setRuns([]);
    setRunsLoaded(false);
    setFocusedTask(null);
  }

  function backToPatients() {
    setSelected(undefined);
    setFocusedTask(null);
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

  const focusedRefs = focusedTask ? new Set(focusedTask.basedOn) : null;

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <AppHeader lastPollAt={lastPollAt} />

      {!selected ? (
        <PatientRoster onSelect={selectPatient} />
      ) : (
        <div className="flex flex-1 flex-col gap-5 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={backToPatients}
                className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </button>
              <span className="flex size-9 items-center justify-center rounded-full bg-foreground text-[12px] font-bold text-background">
                {initials(selected.name)}
              </span>
              <div>
                <div className="text-[15px] font-bold leading-tight">{selected.name}</div>
                <div className="text-[11.5px] text-muted-foreground">
                  {selected.gender ? selected.gender.charAt(0).toUpperCase() + selected.gender.slice(1) : "Unknown sex"}
                  {selected.birthDate ? ` · DOB ${selected.birthDate}` : ""}
                  {" · "}
                  <span className="font-mono">Patient/{selected.id}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-muted/60 px-3 py-1.5 text-[12px] font-medium text-muted-foreground">
                <span className="size-1.5 shrink-0 animate-canvas-soft-pulse rounded-full bg-foreground" />
                Live · polling every {POLL_INTERVAL_MS / 1000}s
              </span>
              <Button onClick={generateQuestionnaire} disabled={sending} variant="outline" size="sm">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <FileQuestion className="size-4" />}
                Trigger questionnaire (demo)
              </Button>
            </div>
          </div>

          {!runsLoaded ? (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
              Loading patient history…
            </div>
          ) : !activeRun ? (
            <div className="flex h-full min-h-[300px] items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground">
              No events received yet for {selected.name}.
              <br />
              The pipeline hasn't run for this patient yet.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0">
                  <RunPicker runs={runs} selectedRunId={activeRun.id} onSelectRunId={selectRun} />
                  <ArchitectureView run={activeRun} selectedBoxKey={selectedBoxKey} onSelectBox={setSelectedBoxKey} />
                </div>
                <div className="rounded-2xl border border-border p-3.5 lg:h-full">
                  <AlertsList
                    patientId={selected.id}
                    focusedTaskId={focusedTask?.id ?? null}
                    onFocus={setFocusedTask}
                    onLoaded={setLastPollAt}
                  />
                </div>
              </div>

              {focusedTask ? (
                <div className="flex items-center justify-between rounded-xl border border-border bg-foreground/[0.03] px-3.5 py-2 text-[12.5px]">
                  <span>
                    Showing evidence for <span className="font-mono">Task/{focusedTask.id}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setFocusedTask(null)}
                    className="rounded-md border border-border px-2 py-0.5 text-[11.5px] font-medium hover:border-foreground/40"
                  >
                    Clear filter
                  </button>
                </div>
              ) : null}

              <Tabs defaultValue="vitals">
                <TabsList>
                  <TabsTrigger value="vitals">Vitals</TabsTrigger>
                  <TabsTrigger value="questionnaires">Questionnaires</TabsTrigger>
                  <TabsTrigger value="ml">ML predictions</TabsTrigger>
                  <TabsTrigger value="agentic">Agentic predictions</TabsTrigger>
                </TabsList>
                <TabsContent value="vitals">
                  <ObservationsList patientId={selected.id} focusedRefs={focusedRefs} />
                </TabsContent>
                <TabsContent value="questionnaires">
                  <QuestionnaireResponsesList patientId={selected.id} focusedRefs={focusedRefs} />
                </TabsContent>
                <TabsContent value="ml">
                  <MlPredictionsList patientId={selected.id} focusedRefs={focusedRefs} />
                </TabsContent>
                <TabsContent value="agentic">
                  <AgenticPredictionsList patientId={selected.id} focusedRefs={focusedRefs} />
                </TabsContent>
              </Tabs>

              <div>
                <h2 className="mb-2 text-[13px] font-semibold">Patient record</h2>
                <PatientHistory patientId={selected.id} />
              </div>
            </>
          )}
        </div>
      )}

      <div className="p-4 pt-0 md:p-6 md:pt-0">
        <RequestLogPanel />
      </div>
    </div>
  );
}
