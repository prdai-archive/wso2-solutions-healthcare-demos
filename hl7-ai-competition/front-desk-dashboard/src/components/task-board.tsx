"use client";

import type { Task, TaskStatus } from "@/lib/types";
import { Clock, Search } from "lucide-react";

import * as React from "react";
import { AssignControl } from "@/components/assign-control";
import { PatientAvatar } from "@/components/patient-avatar";
import { PriorityBadge } from "@/components/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { alertTypeIcon } from "@/lib/alert-icons";
import { useData } from "@/lib/store";
import { cn } from "@/lib/utils";

const columns: { status: TaskStatus; accent: string }[] = [
  { status: "Unassigned", accent: "bg-rose-500" },
  { status: "Assigned", accent: "bg-sky-500" },
  { status: "Closed", accent: "bg-primary" },
];

function TaskCard({ task }: { task: Task }) {
  const { getPatient } = useData();
  const patient = getPatient(task.patientId);
  const Icon = alertTypeIcon[task.alertType];
  return (
    <Card className="gap-0 p-0 transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Icon className="size-3.5" />
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {task.alertType}
            </span>
          </div>
          <PriorityBadge priority={task.priority} />
        </div>

        <p className="text-sm font-medium leading-snug">{task.title}</p>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <PatientAvatar name={patient?.name ?? "?"} className="size-6" />
            <span className="truncate text-xs font-medium">
              {patient?.name}
            </span>
          </div>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            Risk {task.riskScore}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-2.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3" />
            {task.raisedAt}
          </span>
        </div>

        <AssignControl task={task} className="w-full sm:w-full" />
      </CardContent>
    </Card>
  );
}

export function TaskBoard({ tasks }: { tasks: Task[] }) {
  const { getPatient } = useData();
  const [query, setQuery] = React.useState("");
  const [priority, setPriority] = React.useState("all");
  const [type, setType] = React.useState("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      const patient = getPatient(t.patientId);
      const matchesQuery =
        q === "" ||
        t.title.toLowerCase().includes(q) ||
        t.alertType.toLowerCase().includes(q) ||
        (patient?.name.toLowerCase().includes(q) ?? false) ||
        (patient?.mrn.toLowerCase().includes(q) ?? false);
      const matchesPriority = priority === "all" || t.priority === priority;
      const matchesType = type === "all" || t.alertType === type;
      return matchesQuery && matchesPriority && matchesType;
    });
  }, [tasks, query, priority, type, getPatient]);

  const alertTypes = Array.from(new Set(tasks.map((t) => t.alertType)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search alerts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="sm:w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="Urgent">Urgent</SelectItem>
            <SelectItem value="Routine">Routine</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Alert type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All alert types</SelectItem>
            {alertTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map((col) => {
          const colTasks = filtered
            .filter((t) => t.status === col.status)
            .sort((a, b) => b.order - a.order);
          return (
            <div
              key={col.status}
              className="flex flex-col gap-3 rounded-xl bg-muted/40 p-3"
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", col.accent)} />
                  <h2 className="text-sm font-semibold">{col.status}</h2>
                </div>
                <Badge variant="secondary" className="tabular-nums">
                  {colTasks.length}
                </Badge>
              </div>
              <div className="flex flex-col gap-3">
                {colTasks.length === 0 ? (
                  <p className="px-1 py-6 text-center text-xs text-muted-foreground">
                    No alerts
                  </p>
                ) : (
                  colTasks.map((task) => <TaskCard key={task.id} task={task} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
