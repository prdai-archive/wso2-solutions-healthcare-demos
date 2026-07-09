"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 5_000;

interface RequestLogEntry {
  id: number;
  patientId: string;
  endpoint: string;
  triggeredAt: string;
  status: "sent" | "ok" | "error";
  responseSummary: string | null;
}

const statusClasses: Record<RequestLogEntry["status"], string> = {
  sent: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  ok: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  error: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

export function RequestLogPanel() {
  const [entries, setEntries] = useState<RequestLogEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/request-log");
        const data = (await response.json()) as { entries: RequestLogEntry[] };
        if (!cancelled) setEntries(data.entries);
      } catch (error) {
        console.error("failed to poll request log", error);
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
    <Card className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-6 py-3 text-left"
      >
        <span className="text-sm font-medium text-muted-foreground">
          Dashboard request log (local SQLite){entries.length > 0 ? ` · ${entries.length}` : ""}
        </span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <CardContent className="max-h-64 min-h-0 p-0">
          <ScrollArea className="h-64 px-3 pb-3">
            {entries.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No requests fired from this dashboard yet.
              </p>
            ) : (
              <div className="space-y-2">
                {entries.map((entry) => (
                  <div key={entry.id} className="rounded-md border p-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{entry.patientId}</span>
                      <Badge variant="outline" className={statusClasses[entry.status]}>
                        {entry.status}
                      </Badge>
                    </div>
                    <div className="text-muted-foreground">{entry.endpoint}</div>
                    <div className="text-muted-foreground">
                      {new Date(entry.triggeredAt).toLocaleString()}
                    </div>
                    {entry.responseSummary ? (
                      <div className="mt-1 text-muted-foreground">
                        {entry.responseSummary}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      ) : null}
    </Card>
  );
}
