import { Circle, CircleDashed, CheckCircle2, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  AppointmentStatus,
  PatientStatus,
  RiskLevel,
  TaskStatus,
} from "@/lib/types";

const taskConfig: Record<
  TaskStatus,
  { className: string; icon: typeof Circle }
> = {
  Unassigned: {
    className: "text-muted-foreground",
    icon: Circle,
  },
  Assigned: {
    className:
      "bg-sky-500/12 text-sky-600 dark:text-sky-400 dark:bg-sky-500/15",
    icon: UserCheck,
  },
  Closed: {
    className: "bg-primary/12 text-primary dark:bg-primary/15",
    icon: CheckCircle2,
  },
};

export function TaskStatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const { className: tone, icon: Icon } = taskConfig[status];
  return (
    <Badge variant="outline" className={cn("gap-1", tone, className)}>
      <Icon data-icon="inline-start" />
      {status}
    </Badge>
  );
}

const apptTone: Record<AppointmentStatus, string> = {
  Scheduled: "border-border text-muted-foreground",
  Confirmed:
    "bg-sky-500/12 text-sky-600 border-transparent dark:text-sky-400",
  "In review":
    "bg-violet-500/12 text-violet-600 border-transparent dark:text-violet-400",
  Completed: "bg-primary/12 text-primary border-transparent",
  Missed:
    "bg-rose-500/12 text-rose-600 border-transparent dark:text-rose-400",
};

export function AppointmentStatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(apptTone[status], className)}>
      {status}
    </Badge>
  );
}

const patientTone: Record<PatientStatus, { className: string; icon: typeof Circle }> = {
  Flagged: {
    className:
      "bg-rose-500/12 text-rose-600 border-transparent dark:text-rose-400",
    icon: CircleDashed,
  },
  Monitoring: {
    className:
      "bg-sky-500/12 text-sky-600 border-transparent dark:text-sky-400",
    icon: CircleDashed,
  },
  Stable: {
    className: "bg-primary/12 text-primary border-transparent",
    icon: CheckCircle2,
  },
  Inactive: {
    className: "border-border text-muted-foreground",
    icon: Circle,
  },
};

export function PatientStatusBadge({
  status,
  className,
}: {
  status: PatientStatus;
  className?: string;
}) {
  const { className: tone, icon: Icon } = patientTone[status];
  return (
    <Badge variant="outline" className={cn("gap-1", tone, className)}>
      <Icon data-icon="inline-start" />
      {status}
    </Badge>
  );
}

const riskTone: Record<RiskLevel, string> = {
  High: "bg-rose-500/12 text-rose-600 dark:text-rose-400 dark:bg-rose-500/15",
  Moderate:
    "bg-amber-500/15 text-amber-700 dark:text-amber-400 dark:bg-amber-500/15",
  Low: "bg-slate-500/12 text-slate-600 dark:text-slate-300 dark:bg-slate-500/15",
};

export function RiskBadge({
  level,
  score,
  className,
}: {
  level: RiskLevel;
  score?: number;
  className?: string;
}) {
  return (
    <Badge
      variant="ghost"
      className={cn("gap-1 font-medium tabular-nums", riskTone[level], className)}
    >
      {level}
      {typeof score === "number" ? ` · ${score}` : ""}
    </Badge>
  );
}
