"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

const TASKS_POLL_INTERVAL_MS = 4_000;

const URGENT_PRIORITIES = new Set(["urgent", "stat", "asap"]);
const CLOSED_STATUSES = new Set(["completed", "cancelled", "entered-in-error"]);

export interface TaskDto {
  id: string;
  description: string | null;
  authoredOn: string | null;
  status: string;
  priority: string | null;
}

function priorityBadgeVariant(priority: string | null): "destructive" | "outline" {
  return priority && URGENT_PRIORITIES.has(priority.toLowerCase())
    ? "destructive"
    : "outline";
}

function statusBadgeVariant(status: string): "secondary" | "outline" {
  return CLOSED_STATUSES.has(status.toLowerCase()) ? "secondary" : "outline";
}

export function AlertsList({ patientId }: { patientId: string }) {
  const [tasks, setTasks] = useState<TaskDto[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    async function poll() {
      try {
        const response = await fetch(`/api/patients/${patientId}/tasks`);
        const data = (await response.json()) as { tasks: TaskDto[] };
        if (!cancelled) setTasks(data.tasks);
      } catch (error) {
        console.error("failed to poll tasks", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, TASKS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [patientId]);

  if (!loaded) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        No alerts recorded yet for this patient.
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1.5">
        {tasks.map((task) => (
          <Card key={task.id} size="sm">
            <CardContent className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm">{task.description ?? "No description recorded"}</p>
                {task.authoredOn ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {new Date(task.authoredOn).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {task.priority ? (
                  <Badge variant={priorityBadgeVariant(task.priority)}>
                    {task.priority}
                  </Badge>
                ) : null}
                <Badge variant={statusBadgeVariant(task.status)}>{task.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
