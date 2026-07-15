"use client";

import ky from "ky";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { sampleQuestionnaire } from "@/lib/sample";

interface SessionSummary {
  id: string;
  patientId?: string;
  patientName?: string;
  title: string;
  status: string;
  createdAt: string;
  path: string;
}

type Busy = "scripted" | "trigger" | null;

// Live sessions can appear at any moment (the healthkit cron runs on its own ~6 minute
// schedule), so the list polls rather than loading once.
const SESSIONS_POLL_MS = 5_000;

export default function Home() {
  const router = useRouter();
  const [busy, setBusy] = React.useState<Busy>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [triggerNotice, setTriggerNotice] = React.useState<string | null>(
    null,
  );
  const [sessions, setSessions] = React.useState<SessionSummary[]>([]);

  const loadSessions = React.useCallback(async () => {
    try {
      const res = await ky.get("/api/sessions", { throwHttpErrors: false });
      if (!res.ok) return;
      const data = (await res.json()) as { sessions: SessionSummary[] };
      setSessions(data.sessions);
    } catch {
      // best-effort; leave the list as-is
    }
  }, []);

  React.useEffect(() => {
    void loadSessions();
    const interval = setInterval(() => void loadSessions(), SESSIONS_POLL_MS);
    return () => clearInterval(interval);
  }, [loadSessions]);

  async function launchScriptedDemo() {
    setBusy("scripted");
    setError(null);
    try {
      const callbackUrl = new URL(
        "/api/demo-callback",
        window.location.origin,
      ).toString();
      const res = await ky.post("/api/sessions", {
        json: { questionnaire: sampleQuestionnaire, callbackUrl },
        throwHttpErrors: false,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Could not create the demo session.");
        return;
      }
      const data = (await res.json()) as { path: string };
      router.push(data.path);
    } catch {
      setError("Could not create the demo session.");
    } finally {
      setBusy(null);
    }
  }

  async function triggerRealCheck() {
    setBusy("trigger");
    setError(null);
    setTriggerNotice(null);
    try {
      const res = await ky.post("/api/trigger-check", {
        throwHttpErrors: false,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(data?.error ?? "Could not trigger the vitals check.");
        return;
      }
      setTriggerNotice(
        "Vitals check triggered. A live check-in appears below for any patient the ML model escalates.",
      );
      void loadSessions();
    } catch {
      setError("Could not trigger the vitals check.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 p-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">WhatsApp Simulator</h1>
        <p className="text-muted-foreground">
          Renders a pushed questionnaire as a chat and collects the replies.
          Live check-ins are created by the real care-loop pipeline (vitals →
          ML risk model → adaptive agent) and appear below as soon as the
          pipeline escalates a patient.
        </p>
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          The healthkit vitals cron (or the button below) forwards each
          patient&apos;s vitals to the collector, which runs automatically
          every ~6 minutes.
        </li>
        <li>
          Analysis-service scores the vitals with the heart-risk ML model; a
          patient who crosses the risk threshold gets a live check-in here.
        </li>
        <li>
          The patient answers in chat; the agent can also answer general
          questions. The chat stays open for follow-ups after the check-in.
        </li>
      </ol>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button onClick={triggerRealCheck} disabled={busy !== null}>
            {busy === "trigger" ? "Triggering..." : "Run vitals check now"}
          </Button>
          <Button
            variant="outline"
            onClick={launchScriptedDemo}
            disabled={busy !== null}
          >
            {busy === "scripted" ? "Starting..." : "Launch scripted demo"}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {triggerNotice && (
          <p className="text-sm text-muted-foreground">{triggerNotice}</p>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Chats</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions yet.</p>
        ) : (
          <ul className="space-y-1">
            {sessions.map((session) => (
              <li key={session.id}>
                <Link
                  href={session.path}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">
                      {session.patientName ?? session.patientId ?? session.id}
                    </span>
                    <span className="text-muted-foreground">
                      {session.title}
                    </span>
                  </span>
                  <span
                    className={
                      session.status === "completed"
                        ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600"
                        : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600"
                    }
                  >
                    {session.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
