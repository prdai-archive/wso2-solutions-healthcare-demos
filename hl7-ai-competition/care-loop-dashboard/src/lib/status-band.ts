import type { CSSProperties } from "react";

// Mirrors care-loop-analysis-service/task_generator.bal's priorityForProbability
// thresholds exactly, applied to the same "worst of ML vs agentic" probability
// buildEscalationTask uses, so the badge always agrees with what the backend
// would actually escalate to. Pill styles are the mock's bandStyle() values.
export function statusBand(worstProbability: number | null): { label: string; style: CSSProperties } | null {
  if (worstProbability === null) return null;
  if (worstProbability >= 0.85) return { label: "Escalated", style: { background: "#FF7300", color: "#fff" } };
  if (worstProbability >= 0.65)
    return { label: "Watching", style: { color: "#16161a", border: "1px solid rgba(0,0,0,0.35)" } };
  return { label: "Stable", style: { color: "rgba(0,0,0,0.45)", border: "1px solid rgba(0,0,0,0.14)" } };
}
