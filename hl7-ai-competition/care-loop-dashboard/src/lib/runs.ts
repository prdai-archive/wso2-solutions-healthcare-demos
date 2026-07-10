import type { CareLoopEvent } from "@/lib/db";

import { RUN_BOUNDARY_LABEL, STAGE_DEFS } from "@/lib/stages";

export type StageStatus = "done" | "active" | "pending" | "not-observable";

export interface RunStage {
  key: string;
  status: StageStatus;
  event: CareLoopEvent | null;
}

export interface Run {
  id: string;
  startedAt: string;
  endedAt: string;
  isLatest: boolean;
  outcome: string;
  stages: RunStage[];
}

const stageIndexByLabel = new Map(STAGE_DEFS.map((s, i) => [s.label, i]));

/**
 * Segments a patient's full event history into runs. A run starts at each
 * "Vitals ingested" event (the real trigger collector-service fires at the
 * top of every pipeline pass) and includes every event up to the next one.
 * `events` must be ordered newest-first (as listEvents returns).
 */
export function segmentRuns(events: CareLoopEvent[]): Run[] {
  const ascending = [...events].reverse();
  const runs: Run[] = [];
  let current: CareLoopEvent[] = [];

  function flush() {
    if (current.length === 0) return;
    runs.push(buildRun(current, false));
    current = [];
  }

  for (const event of ascending) {
    if (event.label === RUN_BOUNDARY_LABEL) flush();
    current.push(event);
  }
  flush();

  if (runs.length > 0) {
    const latest = runs[runs.length - 1]!;
    latest.isLatest = true;
    // Only show a spinner when the run is genuinely still in flight - it
    // escalated but hasn't reached a FHIR Task yet. A run that legitimately
    // settled below threshold has nothing more coming; don't imply otherwise.
    if (latest.outcome === "Escalated, no Task yet") {
      latest.stages = markLatestActive(latest.stages);
    }
  }

  return runs.reverse();
}

function buildRun(runEvents: CareLoopEvent[], isLatest: boolean): Run {
  const byStageIndex = new Map<number, CareLoopEvent>();
  for (const event of runEvents) {
    const idx = stageIndexByLabel.get(event.label);
    if (idx === undefined) continue;
    // A stage can legitimately fire more than once in a run (e.g. a retried
    // agentic call) - keep the earliest occurrence for a stable timeline.
    if (!byStageIndex.has(idx)) byStageIndex.set(idx, event);
  }

  const stages: RunStage[] = STAGE_DEFS.map((def, i) => {
    if (def.key === "clinician") {
      return { key: def.key, status: "not-observable", event: null };
    }
    const event = byStageIndex.get(i) ?? null;
    if (event) return { key: def.key, status: "done", event };
    return { key: def.key, status: "pending", event: null };
  });

  const hasTask = byStageIndex.has(stageIndexByLabel.get("FHIR Task created for front-desk")!);
  const hasEscalation = byStageIndex.has(stageIndexByLabel.get("Escalation triggered")!);
  const outcome = hasTask
    ? "Task created"
    : hasEscalation
      ? "Escalated, no Task yet"
      : "Below escalation threshold";

  const startedAt = runEvents[0]!.receivedAt;
  const endedAt = runEvents[runEvents.length - 1]!.receivedAt;

  return {
    id: startedAt,
    startedAt,
    endedAt,
    isLatest,
    outcome,
    stages,
  };
}

// Only the single most-recent run's furthest-reached non-terminal stage is
// shown as "active" (a spinner) - every other run is settled history.
function markLatestActive(stages: RunStage[]): RunStage[] {
  let lastDoneIndex = -1;
  stages.forEach((s, i) => {
    if (s.status === "done") lastDoneIndex = i;
  });
  if (lastDoneIndex === -1 || lastDoneIndex >= stages.length - 2) return stages;
  return stages.map((s, i) => (i === lastDoneIndex ? { ...s, status: "active" } : s));
}
