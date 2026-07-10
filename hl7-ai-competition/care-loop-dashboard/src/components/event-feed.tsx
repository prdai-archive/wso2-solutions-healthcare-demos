"use client";

import type { CareLoopEvent } from "@/lib/db";
import type { OpsPatient } from "@/app/api/patients/route";

import { Activity, FileQuestion, Loader2 } from "lucide-react";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 4_000;

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EventRow({ event, isLast }: { event: CareLoopEvent; isLast: boolean }) {
  return (
    <div className="group flex gap-4 rounded-xl px-2">
      <div className="flex flex-col items-center pt-0.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <Activity className="size-4" />
        </span>
        {!isLast ? <div className="w-[3px] flex-1 rounded-full bg-border/70" /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold">{event.label}</span>
          <span className="text-[11px] text-muted-foreground/60">
            {formatTime(event.receivedAt)}
          </span>
        </div>
        {event.detail ? (
          <p className="truncate text-xs text-muted-foreground">{event.detail}</p>
        ) : null}
      </div>
    </div>
  );
}

export function EventFeed({ patient }: { patient: OpsPatient }) {
  const [events, setEvents] = useState<CareLoopEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    async function poll() {
      try {
        const response = await fetch(`/api/patients/${patient.id}/events`);
        const data = (await response.json()) as { events: CareLoopEvent[] };
        if (!cancelled) setEvents(data.events);
      } catch (error) {
        console.error("failed to poll patient events", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [patient.id]);

  async function generateQuestionnaire() {
    setSending(true);
    try {
      const response = await fetch("/api/questionnaires", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patientId: patient.id }),
      });
      if (response.ok) {
        toast.success(`Questionnaire request sent for ${patient.name}`, {
          description:
            "care-loop-ai-service POST /questionnaires — fire-and-forget, watch the event feed below for the result.",
        });
      } else {
        toast.error("Failed to send questionnaire request");
      }
    } catch (error) {
      console.error("failed to trigger questionnaire generation", error);
      toast.error("Failed to send questionnaire request");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{patient.name}</h2>
          <p className="text-sm text-muted-foreground">
            {patient.id}
            {patient.gender ? ` · ${patient.gender}` : ""}
            {patient.birthDate ? ` · ${patient.birthDate}` : ""}
          </p>
        </div>
        <Button onClick={generateQuestionnaire} disabled={sending} variant="outline" size="sm">
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FileQuestion className="size-4" />
          )}
          Trigger questionnaire (demo)
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-2xl border border-border/70 bg-[linear-gradient(180deg,var(--color-card)_0%,color-mix(in_oklch,var(--color-muted)_35%,var(--color-card))_100%)] p-4 shadow-sm">
        {!loaded ? (
          <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading events…
          </p>
        ) : events.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
            No events received yet for this patient.
          </p>
        ) : (
          <div className="flex flex-1 flex-col">
            {events.map((event, index) => (
              <EventRow key={event.id} event={event} isLast={index === events.length - 1} />
            ))}
          </div>
        )}
      </div>

      <p className="flex-shrink-0 text-center text-[11px] text-muted-foreground">
        Live feed, polled every {POLL_INTERVAL_MS / 1000}s — backend services POST events to this
        dashboard as they happen.
      </p>
    </div>
  );
}
