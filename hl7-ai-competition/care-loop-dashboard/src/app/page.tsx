"use client";

import type { HomeSummary } from "@/app/api/home-summary/route";
import type { QuestionnaireResponseSummary } from "@/app/api/patients/[id]/questionnaire-responses/route";
import type { RiskAssessmentSummary } from "@/app/api/patients/[id]/risk-assessments/route";
import type { TaskSummary } from "@/app/api/patients/[id]/tasks/route";
import type { OpsPatient } from "@/app/api/patients/route";
import type { Run } from "@/lib/runs";
import type { ObservationDto } from "@/lib/vitals";

import { useEffect, useState } from "react";

import { AlertsList } from "@/components/alerts/alerts-list";
import { AppHeader } from "@/components/app-header";
import { RunTimeline } from "@/components/architecture/run-timeline";
import { CommandPalette } from "@/components/command-palette";
import { HomeView } from "@/components/home/home-view";
import { PatientMetrics } from "@/components/patient/patient-metrics";
import { AgenticPredictionsList } from "@/components/resources/agentic-predictions-list";
import { MlPredictionsList } from "@/components/resources/ml-predictions-list";
import { ObservationsList } from "@/components/resources/observations-list";
import { PatientHistory } from "@/components/resources/patient-history";
import { QuestionnaireResponsesList } from "@/components/resources/questionnaire-responses-list";
import { statusBand } from "@/lib/status-band";
import { cn } from "@/lib/utils";
import { displayableRows } from "@/lib/vitals";

const POLL_INTERVAL_MS = 4_000;
const PATIENTS_POLL_INTERVAL_MS = 15_000;

const ML_METHOD_MARKER = "heart-risk-service";
const AGENTIC_METHOD_MARKER = "ai-service";

const EMPTY_HOME_SUMMARY: HomeSummary = {
  totalPatients: 0,
  openTasks: 0,
  escalationsToday: 0,
  avgMlRisk: null,
  latestEvent: null,
  patients: [],
};

type TabId = "vitals" | "questionnaires" | "ml" | "agentic";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

// FHIR request-priority codes, most urgent first, for picking the KPI tile's headline priority.
const TASK_PRIORITY_ORDER = ["stat", "asap", "urgent", "routine"];

function highestTaskPriority(tasks: TaskSummary[]): string | null {
  const priorities = tasks.map((task) => task.priority?.toLowerCase()).filter((p): p is string => p != null);
  if (priorities.length === 0) return null;
  const ranked = [...priorities].sort(
    (a, b) =>
      (TASK_PRIORITY_ORDER.includes(a) ? TASK_PRIORITY_ORDER.indexOf(a) : TASK_PRIORITY_ORDER.length) -
      (TASK_PRIORITY_ORDER.includes(b) ? TASK_PRIORITY_ORDER.indexOf(b) : TASK_PRIORITY_ORDER.length),
  );
  return ranked[0] ?? null;
}

// Vitals render as per-minute rows (displayableRows) while Task.basedOn lists
// individual Observations - keep whole rows that contain a linked observation.
function filterObservationsByFocus(observations: ObservationDto[], focusedRefs: Set<string>): ObservationDto[] {
  const linkedBuckets = new Set<string>();
  for (const observation of observations) {
    if (observation.effectiveDateTime && focusedRefs.has(`Observation/${observation.id}`)) {
      linkedBuckets.add(observation.effectiveDateTime.slice(0, 16));
    }
  }
  return observations.filter(
    (observation) =>
      observation.effectiveDateTime !== null && linkedBuckets.has(observation.effectiveDateTime.slice(0, 16)),
  );
}

export default function DashboardPage() {
  const [selected, setSelected] = useState<OpsPatient | undefined>(undefined);

  const [patients, setPatients] = useState<OpsPatient[]>([]);
  const [patientsLoaded, setPatientsLoaded] = useState(false);
  const [homeSummary, setHomeSummary] = useState<HomeSummary>(EMPTY_HOME_SUMMARY);
  const [homeSummaryLoaded, setHomeSummaryLoaded] = useState(false);

  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoaded, setRunsLoaded] = useState(false);
  const [focusedTask, setFocusedTask] = useState<TaskSummary | null>(null);
  const [openTaskPriority, setOpenTaskPriority] = useState<string | null>(null);
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const [riskAssessments, setRiskAssessments] = useState<RiskAssessmentSummary[]>([]);
  const [riskAssessmentsLoaded, setRiskAssessmentsLoaded] = useState(false);
  const [observations, setObservations] = useState<ObservationDto[]>([]);
  const [observationsLoaded, setObservationsLoaded] = useState(false);
  const [responses, setResponses] = useState<QuestionnaireResponseSummary[]>([]);
  const [responsesLoaded, setResponsesLoaded] = useState(false);
  const [tab, setTab] = useState<TabId>("vitals");
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Mock's global Cmd/Ctrl+K shortcut for the search palette.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Home screen: patient list + aggregate/per-patient rollups.
  useEffect(() => {
    if (selected) return;
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/patients");
        const data = (await response.json()) as { patients: OpsPatient[] };
        if (!cancelled) setPatients(data.patients);
      } catch (error) {
        console.error("failed to poll patients", error);
      } finally {
        if (!cancelled) setPatientsLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, PATIENTS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selected]);

  useEffect(() => {
    if (selected) return;
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/home-summary");
        const data = (await response.json()) as HomeSummary;
        if (!cancelled) setHomeSummary(data);
      } catch (error) {
        console.error("failed to poll home summary", error);
      } finally {
        if (!cancelled) setHomeSummaryLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selected]);

  // Patient screen: runs (for the timeline), risk assessments (shared by ML
  // tab, agentic tab, and the alerts ML/Agent columns), observations (KPI
  // tiles + vitals tab) and questionnaire responses all poll per patient.
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

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setRiskAssessmentsLoaded(false);

    async function poll() {
      try {
        const response = await fetch(`/api/patients/${selected!.id}/risk-assessments`);
        const data = (await response.json()) as { riskAssessments: RiskAssessmentSummary[] };
        if (!cancelled) setRiskAssessments(data.riskAssessments);
      } catch (error) {
        console.error("failed to poll risk assessments", error);
      } finally {
        if (!cancelled) setRiskAssessmentsLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setObservationsLoaded(false);

    async function poll() {
      try {
        const response = await fetch(`/api/patients/${selected!.id}/observations`);
        const data = (await response.json()) as { observations: ObservationDto[] };
        if (!cancelled) setObservations(data.observations);
      } catch (error) {
        console.error("failed to poll observations", error);
      } finally {
        if (!cancelled) setObservationsLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setResponsesLoaded(false);

    async function poll() {
      try {
        const response = await fetch(`/api/patients/${selected!.id}/questionnaire-responses`);
        const data = (await response.json()) as { responses: QuestionnaireResponseSummary[] };
        if (!cancelled) setResponses(data.responses);
      } catch (error) {
        console.error("failed to poll questionnaire responses", error);
      } finally {
        if (!cancelled) setResponsesLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selected]);

  const latestRun = runs[0];

  function selectPatient(patient: OpsPatient) {
    setSelected(patient);
    setRuns([]);
    setRunsLoaded(false);
    setRiskAssessments([]);
    setRiskAssessmentsLoaded(false);
    setObservations([]);
    setObservationsLoaded(false);
    setResponses([]);
    setResponsesLoaded(false);
    setFocusedTask(null);
    setOpenTaskPriority(null);
    setTab("vitals");
  }

  function backToPatients() {
    setSelected(undefined);
    setFocusedTask(null);
  }

  const focusedRefs = focusedTask ? new Set(focusedTask.basedOn) : null;
  const mlPredictions = riskAssessments.filter((r) => r.method?.toLowerCase().includes(ML_METHOD_MARKER));
  const agenticPredictions = riskAssessments.filter((r) => r.method?.toLowerCase().includes(AGENTIC_METHOD_MARKER));
  const latestMlProbability = mlPredictions[0]?.predictions[0]?.probability ?? null;
  const latestAgenticProbability = agenticPredictions[0]?.predictions[0]?.probability ?? null;
  const worstProbability =
    latestMlProbability === null && latestAgenticProbability === null
      ? null
      : Math.max(latestMlProbability ?? -Infinity, latestAgenticProbability ?? -Infinity);
  const band = selected ? statusBand(worstProbability) : null;

  // Mock's focus filter narrows only the vitals and ML tabs (fVitals/fMl in
  // the mock script); questionnaires and agent reasoning stay unfiltered.
  const visibleObservations = focusedRefs ? filterObservationsByFocus(observations, focusedRefs) : observations;
  const visibleResponses = responses;
  const visibleMlPredictions = focusedRefs
    ? mlPredictions.filter((assessment) => focusedRefs.has(`RiskAssessment/${assessment.id}`))
    : mlPredictions;
  const visibleAgenticPredictions = agenticPredictions;

  const tabDefs: { id: TabId; label: string; count: number }[] = [
    { id: "vitals", label: "Vitals", count: displayableRows(visibleObservations).length },
    { id: "questionnaires", label: "Questionnaires", count: visibleResponses.length },
    { id: "ml", label: "ML predictions", count: visibleMlPredictions.length },
    { id: "agentic", label: "Agent reasoning", count: visibleAgenticPredictions.length },
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <AppHeader lastPollAt={lastPollAt} />

      {/* Kept mounted (display:none) so the home search/page state survives a patient visit, mirroring the mock's back(); re-display restarts the fadeUp entry animation. */}
      <div className="animate-canvas-fade-up flex flex-1 flex-col" style={selected ? { display: "none" } : undefined}>
        <HomeView
          patients={patients}
          patientsLoaded={patientsLoaded}
          summary={homeSummary}
          summaryLoaded={homeSummaryLoaded}
          onSelect={selectPatient}
        />
      </div>
      {selected ? (
        <div className="animate-canvas-fade-up mx-auto w-full max-w-[1240px] flex-1 px-6 pt-6 pb-[72px]">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                onClick={backToPatients}
                className="flex size-8 cursor-pointer items-center justify-center rounded-[9px] border border-[rgba(0,0,0,0.12)] bg-white text-[14px] text-[rgba(0,0,0,0.6)] transition-colors hover:border-accent-brand hover:bg-accent-brand hover:text-white"
              >
                ←
              </button>
              <div className="flex size-[38px] items-center justify-center rounded-[11px] bg-accent-brand text-[13px] font-bold text-white">
                {initials(selected.name)}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[18px] font-bold tracking-[-0.3px] text-[#16161a]">{selected.name}</span>
                  {band ? (
                    <span className="rounded-[20px] px-[9px] py-[3px] text-[10.5px] font-semibold" style={band.style}>
                      {band.label}
                    </span>
                  ) : null}
                </div>
                <div className="mt-px font-mono text-[11px] text-[rgba(0,0,0,0.4)]">
                  {selected.gender ? selected.gender.charAt(0).toUpperCase() + selected.gender.slice(1) : "Unknown sex"}
                  {selected.birthDate ? ` · ${selected.birthDate}` : ""}
                  {` · Patient/${selected.id}`}
                </div>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <PatientMetrics
              observations={observations}
              mlPredictions={mlPredictions}
              agenticPredictions={agenticPredictions}
              openTaskCount={homeSummary.patients.find((row) => row.id === selected.id)?.openTasks ?? 0}
              openTaskPriority={openTaskPriority}
            />
          </div>

          {!runsLoaded ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-[rgba(0,0,0,0.14)] text-sm text-[rgba(0,0,0,0.45)]">
              Loading patient history…
            </div>
          ) : !latestRun ? (
            <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-[rgba(0,0,0,0.14)] text-center text-sm text-[rgba(0,0,0,0.45)]">
              No events received yet for {selected.name}.
              <br />
              The pipeline hasn't run for this patient yet.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4">
                <RunTimeline run={latestRun} />
                <AlertsList
                  patientId={selected.id}
                  focusedTaskId={focusedTask?.id ?? null}
                  onFocus={setFocusedTask}
                  onLoaded={setLastPollAt}
                  onOpenTasks={(openTasks) => setOpenTaskPriority(highestTaskPriority(openTasks))}
                  mlPredictions={mlPredictions}
                  agenticPredictions={agenticPredictions}
                />
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white">
                <div className="flex flex-wrap items-center gap-1 border-b border-[rgba(0,0,0,0.06)] px-3.5 py-2.5">
                  {tabDefs.map((tabDef) => {
                    const on = tab === tabDef.id;
                    return (
                      <button
                        key={tabDef.id}
                        type="button"
                        onClick={() => setTab(tabDef.id)}
                        className={cn(
                          "flex cursor-pointer items-center gap-[7px] rounded-lg border px-[13px] py-[7px] text-[12.5px] font-semibold transition-colors",
                          on
                            ? "border-accent-brand bg-accent-brand text-white"
                            : "border-transparent bg-transparent text-[rgba(0,0,0,0.55)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[#16161a]",
                        )}
                      >
                        {tabDef.label}
                        <span
                          className={cn(
                            "rounded-[10px] px-1.5 py-px font-mono text-[10px] font-semibold",
                            on ? "bg-white/18 text-white" : "bg-[rgba(0,0,0,0.06)] text-[rgba(0,0,0,0.5)]",
                          )}
                        >
                          {tabDef.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {focusedTask ? (
                  <div className="flex items-center justify-between gap-3 bg-accent-brand px-5 py-[9px] text-white">
                    <span className="flex items-center gap-2 text-[11.5px] font-medium">
                      <span className="animate-canvas-soft-pulse size-1.5 rounded-full bg-white" />
                      Showing evidence for{" "}
                      <span className="rounded-[5px] bg-white/14 px-[7px] py-px font-mono text-[10.5px]">
                        Task/{focusedTask.id}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setFocusedTask(null)}
                      className="cursor-pointer rounded-[5px] bg-white px-2.5 py-1 text-[10.5px] font-semibold text-[#16161a] hover:bg-white/85"
                    >
                      Clear filter
                    </button>
                  </div>
                ) : null}

                {tab === "vitals" ? (
                  <ObservationsList
                    observations={visibleObservations}
                    loaded={observationsLoaded}
                    focusedRefs={focusedRefs}
                  />
                ) : null}
                {tab === "questionnaires" ? (
                  <QuestionnaireResponsesList
                    responses={visibleResponses}
                    loaded={responsesLoaded}
                    focusedRefs={focusedRefs}
                  />
                ) : null}
                {tab === "ml" ? (
                  <MlPredictionsList
                    riskAssessments={visibleMlPredictions}
                    loaded={riskAssessmentsLoaded}
                    focusedRefs={focusedRefs}
                  />
                ) : null}
                {tab === "agentic" ? (
                  <AgenticPredictionsList
                    riskAssessments={visibleAgenticPredictions}
                    latestMlProbability={latestMlProbability}
                    loaded={riskAssessmentsLoaded}
                    focusedRefs={focusedRefs}
                  />
                ) : null}
              </div>

              <PatientHistory patient={selected} />
            </>
          )}
        </div>
      ) : null}

      {paletteOpen ? (
        <CommandPalette
          patients={patients}
          summaryRows={homeSummary.patients}
          onSelect={(patient) => {
            setPaletteOpen(false);
            selectPatient(patient);
          }}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}
    </div>
  );
}
