import type { CSSProperties } from "react";

// The escalation decision's real record is the FHIR Task analysis-service creates - an open Task means the patient is escalated, no open Task means stable. No probability-vs-threshold math. Pill styles are the mock's bandStyle() values.
export function statusBand(hasOpenTask: boolean): { label: string; style: CSSProperties } {
  if (hasOpenTask) {
    return { label: "Escalated", style: { background: "#FF7300", color: "#fff" } };
  }
  return { label: "Stable", style: { color: "rgba(0,0,0,0.45)", border: "1px solid rgba(0,0,0,0.14)" } };
}
