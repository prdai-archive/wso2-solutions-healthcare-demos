"use client";

import type { TaskSummary } from "@/app/api/patients/[id]/tasks/route";

import { CheckCircle2, Crosshair } from "lucide-react";
import { useEffect, useState } from "react";

import { FhirButton } from "@/components/resources/fhir-drawer";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TASKS_POLL_INTERVAL_MS = 4_000;

const URGENT_PRIORITIES = new Set(["urgent", "stat", "asap"]);
const CLOSED_STATUSES = new Set(["completed", "cancelled", "entered-in-error"]);

export type TaskDto = TaskSummary;

function priorityBadgeVariant(priority: string | null): "destructive" | "outline" {
  return priority && URGENT_PRIORITIES.has(priority.toLowerCase()) ? "destructive" : "outline";
}

function statusBadgeVariant(status: string): "secondary" | "outline" {
  return CLOSED_STATUSES.has(status.toLowerCase()) ? "secondary" : "outline";
}

export function AlertsList({
  patientId,
  focusedTaskId,
  onFocus,
  onLoaded,
}: {
  patientId: string;
  focusedTaskId: string | null;
  onFocus: (task: TaskSummary | null) => void;
  onLoaded?: (loadedAt: number) => void;
}) {
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    async function poll() {
      try {
        const response = await fetch(`/api/patients/${patientId}/tasks`);
        const data = (await response.json()) as { tasks: TaskSummary[] };
        if (!cancelled) {
          setTasks(data.tasks);
          onLoaded?.(Date.now());
        }
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
    // eslint-disable-next-line react/exhaustive-deps
  }, [patientId]);

  const openTasks = tasks.filter((task) => !CLOSED_STATUSES.has(task.status.toLowerCase()));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-1 pb-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-[13.5px] font-semibold">Alerts</h2>
          <span className="flex size-5 items-center justify-center rounded-full bg-foreground/8 text-[11px] font-semibold text-foreground/70">
            {openTasks.length}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/50">Task?status=requested</span>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {!loaded ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : openTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border/70 py-9 text-center">
            <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-border/70 text-muted-foreground/50">
              <CheckCircle2 className="size-4" />
            </span>
            <p className="text-[12.5px] text-muted-foreground">
              {tasks.length === 0
                ? "No Task resources recorded yet for this patient."
                : "No open Tasks — all recorded Tasks are closed."}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {openTasks.map((task) => {
              const focused = focusedTaskId === task.id;
              return (
                <div
                  key={task.id}
                  className={cn(
                    "rounded-xl border border-border p-2.5 transition-colors",
                    focused && "border-foreground/50 bg-foreground/[0.03]",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex shrink-0 items-center gap-1.5">
                      {task.priority ? (
                        <Badge variant={priorityBadgeVariant(task.priority)}>{task.priority}</Badge>
                      ) : null}
                      <Badge variant={statusBadgeVariant(task.status)}>{task.status}</Badge>
                    </div>
                    {task.authoredOn ? (
                      <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground/60">
                        {new Date(task.authoredOn).toLocaleTimeString([], { hour12: false })}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[12.5px] leading-snug">
                    {task.description ?? "No description recorded"}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onFocus(focused ? null : task)}
                      disabled={task.basedOn.length === 0}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium transition-colors",
                        focused
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40",
                      )}
                    >
                      <Crosshair className="size-3" />
                      Focus
                    </button>
                    <FhirButton resourcePath={`Task/${task.id}`} raw={task.raw} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
