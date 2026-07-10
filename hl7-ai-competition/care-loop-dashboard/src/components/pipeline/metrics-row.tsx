"use client";

import type { Run } from "@/lib/runs";

import { useEffect, useState } from "react";

import { STAGE_DEFS } from "@/lib/stages";

const POLL_INTERVAL_MS = 4_000;

interface EventStats {
  hitsToday: number;
  lastHitAt: string | null;
}

function furthestReachedIndex(run: Run): number {
  let last = -1;
  run.stages.forEach((s, i) => {
    if (s.status === "done" || s.status === "active") last = i;
  });
  return last;
}

export function MetricsRow({ run }: { run: Run }) {
  const [stats, setStats] = useState<EventStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch("/api/events/stats");
        const data = (await response.json()) as EventStats;
        if (!cancelled) setStats(data);
      } catch (error) {
        console.error("failed to poll event stats", error);
      }
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const idx = furthestReachedIndex(run);
  const activeService = idx >= 0 ? STAGE_DEFS[idx]!.service : "—";
  const lastHit = stats?.lastHitAt ? new Date(stats.lastHitAt).toLocaleTimeString() : "—";

  const metrics = [
    { label: "Stage", value: `${idx + 1} / ${STAGE_DEFS.length}`, mono: true },
    { label: "Active service", value: activeService, mono: false },
    { label: "Hits today", value: stats ? String(stats.hitsToday) : "—", mono: true },
    { label: "Last hit", value: lastHit, mono: true },
  ];

  return (
    <div className="mb-3.5 flex flex-wrap items-baseline gap-6">
      {metrics.map((m) => (
        <div key={m.label}>
          <div className="text-[10.5px] font-semibold tracking-wide text-muted-foreground/70 uppercase">
            {m.label}
          </div>
          <div className={`mt-0.5 text-base font-semibold ${m.mono ? "font-mono" : ""}`}>{m.value}</div>
        </div>
      ))}
    </div>
  );
}
