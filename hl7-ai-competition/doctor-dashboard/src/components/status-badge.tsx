import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  AppointmentStatus,
  LabResult,
  RiskLevel,
  Severity,
} from "@/lib/types";

const riskStyles: Record<RiskLevel, string> = {
  High: "bg-destructive/12 text-destructive dark:bg-destructive/25",
  Moderate:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:bg-amber-500/20",
  Low: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/20",
};

export function RiskBadge({
  level,
  score,
}: {
  level: RiskLevel;
  score?: number;
}) {
  return (
    <Badge className={cn("border-transparent", riskStyles[level])}>
      {level}
      {typeof score === "number" ? ` ${score}` : null}
    </Badge>
  );
}

const severityStyles: Record<Severity, string> = {
  Routine:
    "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/20",
  Abnormal:
    "bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:bg-amber-500/20",
  Urgent:
    "bg-orange-500/15 text-orange-700 dark:text-orange-300 dark:bg-orange-500/20",
  Critical:
    "bg-destructive/12 text-destructive dark:bg-destructive/25",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge className={cn("border-transparent", severityStyles[severity])}>
      {severity}
    </Badge>
  );
}

const statusStyles: Record<AppointmentStatus, string> = {
  Scheduled: "bg-muted text-muted-foreground",
  "Checked-in":
    "bg-blue-500/12 text-blue-700 dark:text-blue-300 dark:bg-blue-500/20",
  "In room":
    "bg-primary/12 text-primary dark:bg-primary/25 dark:text-primary-foreground",
  Completed:
    "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/20",
};

export function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentStatus;
}) {
  return (
    <Badge className={cn("border-transparent", statusStyles[status])}>
      {status}
    </Badge>
  );
}

const labFlagStyles: Record<LabResult["flag"], string> = {
  Normal: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 dark:bg-emerald-500/20",
  High: "bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:bg-amber-500/20",
  Low: "bg-amber-500/15 text-amber-700 dark:text-amber-300 dark:bg-amber-500/20",
  Critical: "bg-destructive/12 text-destructive dark:bg-destructive/25",
};

export function LabFlagBadge({ flag }: { flag: LabResult["flag"] }) {
  return (
    <Badge className={cn("border-transparent", labFlagStyles[flag])}>
      {flag}
    </Badge>
  );
}
