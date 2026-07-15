import type { CSSProperties } from "react";

// Mirrors care-loop-analysis-service/config.bal's default mlEscalationThreshold/agenticEscalationThreshold (0.5).
const DEFAULT_ESCALATION_THRESHOLD = 0.5;

// Band from the worst of the latest ML and agentic probabilities, against the real
// escalation threshold (from the newest ML RiskAssessment's rationale when available,
// the config.bal default otherwise) - the same comparison the backend actually escalates on.
// Pill styles are the mock's bandStyle() values.
export function statusBandFor(
  mlProbability: number | null,
  agenticProbability: number | null,
  escalationThreshold: number | null,
): { label: string; style: CSSProperties } | null {
  if (mlProbability === null && agenticProbability === null) return null;
  const worst = Math.max(mlProbability ?? -Infinity, agenticProbability ?? -Infinity);
  if (worst >= (escalationThreshold ?? DEFAULT_ESCALATION_THRESHOLD)) {
    return { label: "Escalated", style: { background: "#FF7300", color: "#fff" } };
  }
  return { label: "Stable", style: { color: "rgba(0,0,0,0.45)", border: "1px solid rgba(0,0,0,0.14)" } };
}
