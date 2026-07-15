const RATIONALE_PATTERN = /^threshold=([\d.]+) outcome=(escalated|not-escalated)$/;

// analysis-service encodes the real per-request threshold/outcome into prediction[0].rationale (see buildMlRiskAssessment). Records saved before that field existed won't match, so fall back to "—" rather than guessing.
export function parseMlRationale(rationale: string | null | undefined): { threshold: string; outcome: string } {
  const match = rationale ? RATIONALE_PATTERN.exec(rationale) : null;
  if (!match) return { threshold: "—", outcome: "—" };
  // Mock renders thresholds with two decimals ("0.50"), matching probability formatting.
  return { threshold: Number.parseFloat(match[1]).toFixed(2), outcome: match[2] };
}

// Numeric form of the same encoded threshold, for band math; null when the record predates the field.
export function parseEscalationThreshold(rationale: string | null | undefined): number | null {
  const match = rationale ? RATIONALE_PATTERN.exec(rationale) : null;
  return match ? Number.parseFloat(match[1]!) : null;
}

const AGENTIC_RISK_PATTERN = /^risk=(low|moderate|high)$/;

// care-loop-analysis-service persists the agent's band as prediction[0].rationale "risk=<band>" (see fhir_resources.bal). Anything else means no real band recorded.
export function parseAgenticRisk(rationale: string | null | undefined): string | null {
  const match = rationale ? AGENTIC_RISK_PATTERN.exec(rationale) : null;
  return match ? match[1] : null;
}
