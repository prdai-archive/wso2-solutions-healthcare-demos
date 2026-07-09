export type RiskLevel = "low" | "moderate" | "high";

export function riskLevelFor(probability: number | undefined): RiskLevel | undefined {
  if (probability === undefined) return undefined;
  if (probability >= 0.7) return "high";
  if (probability >= 0.4) return "moderate";
  return "low";
}

export const riskLevelClasses: Record<RiskLevel, string> = {
  low: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  moderate:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};
