import type { AppointmentStatus, TaskStatus } from "@/lib/types";

import { CheckCircle2, Circle, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const taskConfig: Record<
  TaskStatus,
  { className: string; icon: typeof Circle }
> = {
  Unassigned: {
    className: "text-muted-foreground",
    icon: Circle,
  },
  Assigned: {
    className: "bg-sky-500/12 text-sky-600",
    icon: UserCheck,
  },
  Closed: {
    className: "bg-primary/12 text-primary",
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
  Confirmed: "bg-sky-500/12 text-sky-600 border-transparent",
  "In review": "bg-violet-500/12 text-violet-600 border-transparent",
  Completed: "bg-primary/12 text-primary border-transparent",
  Missed: "bg-rose-500/12 text-rose-600 border-transparent",
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
