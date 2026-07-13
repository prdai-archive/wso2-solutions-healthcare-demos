"use client";

import { Activity } from "lucide-react";
import { useEffect, useState } from "react";

export function AppHeader({ lastPollAt }: { lastPollAt: number | null }) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  // Prefer the most recent real poll timestamp over the wall clock, so the
  // header reflects actual data freshness rather than implying a tighter
  // update cadence than the 4s polling loop.
  const displayed = lastPollAt ?? now;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4 md:px-6">
      <div className="flex items-center gap-2">
        <Activity className="size-[18px] text-foreground" />
        <span className="text-[15px] font-bold tracking-tight">Care Loop</span>
      </div>
      <span className="font-mono text-[11.5px] text-muted-foreground/60">
        last update {new Date(displayed).toLocaleTimeString([], { hour12: false })}
      </span>
    </header>
  );
}
