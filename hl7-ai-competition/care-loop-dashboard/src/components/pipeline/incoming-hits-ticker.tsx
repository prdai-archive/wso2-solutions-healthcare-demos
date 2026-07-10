"use client";

import type { CareLoopEvent } from "@/lib/db";

import { useEffect, useState } from "react";

const POLL_INTERVAL_MS = 4_000;

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function IncomingHitsTicker() {
  const [events, setEvents] = useState<CareLoopEvent[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch("/api/events/recent");
        const data = (await response.json()) as { events: CareLoopEvent[] };
        if (!cancelled) setEvents(data.events);
      } catch (error) {
        console.error("failed to poll recent events", error);
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
    <div className="rounded-2xl border border-border bg-background p-5">
      <div className="mb-3.5 flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-foreground/70">Incoming hits</span>
        <span className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <span className="size-1.5 animate-canvas-soft-pulse rounded-full bg-foreground" />
          live · all patients
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {events.length === 0 ? (
          <p className="font-mono text-[11px] text-muted-foreground">awaiting first hit</p>
        ) : (
          events.slice(0, 6).map((event) => (
            <div key={event.id} className="flex items-center gap-2.5 font-mono text-[11px]">
              <span className="shrink-0 text-muted-foreground/60">{formatTime(event.receivedAt)}</span>
              <span className="shrink-0 rounded bg-foreground/5 px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground">
                POST
              </span>
              <span className="min-w-0 flex-1 truncate text-foreground/85">{event.label}</span>
              <span className="shrink-0 rounded bg-foreground/5 px-1.5 py-0.5 text-[9.5px] font-semibold text-muted-foreground">
                202
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
