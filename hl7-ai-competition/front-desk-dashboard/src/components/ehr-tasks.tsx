"use client";

import type { EhrTask } from "@/app/api/tasks/route";

import { ClipboardCheck } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

const POLL_INTERVAL_MS = 15_000;

export function EhrTasks() {
  const [tasks, setTasks] = React.useState<EhrTask[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/tasks");
        const body = await response.json();
        if (!cancelled) setTasks(body.tasks ?? []);
      } catch {
        if (!cancelled) setTasks([]);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Card className="gap-0">
      <CardHeader className="border-b pb-4">
        <CardTitle>Active EHR tasks</CardTitle>
        <CardDescription>
          {tasks.length} requested tasks awaiting action in the EHR.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[280px]">
          {tasks.length === 0 ? (
            <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
              <ClipboardCheck className="size-5" />
              No active tasks.
            </div>
          ) : (
            <ul className="divide-y">
              {tasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {task.description}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {task.patientId ? `Patient/${task.patientId}` : "Unknown patient"}
                      {task.authoredOn ? ` · ${task.authoredOn}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">{task.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
