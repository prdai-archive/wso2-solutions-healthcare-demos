"use client";

import type { TaskSummary } from "@/app/api/patients/[id]/tasks/route";
import type { OpsPatient } from "@/app/api/patients/route";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

const PATIENTS_POLL_INTERVAL_MS = 15_000;
const TASKS_POLL_INTERVAL_MS = 4_000;
const CLOSED_STATUSES = new Set(["completed", "cancelled", "entered-in-error"]);

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

function openTaskCount(tasks: TaskSummary[]): number {
  return tasks.filter((task) => !CLOSED_STATUSES.has(task.status.toLowerCase())).length;
}

// Full-screen patient picker: the first thing shown before any patient is
// selected. Card footers summarize real open-task counts, not a fabricated
// acuity band.
export function PatientRoster({
  onSelect,
}: {
  onSelect: (patient: OpsPatient) => void;
}) {
  const [patients, setPatients] = useState<OpsPatient[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openTasks, setOpenTasks] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/patients");
        const data = (await response.json()) as { patients: OpsPatient[] };
        if (!cancelled) setPatients(data.patients);
      } catch (error) {
        console.error("failed to poll patients", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, PATIENTS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (patients.length === 0) return;
    let cancelled = false;

    async function pollTasks() {
      try {
        const entries = await Promise.all(
          patients.map(async (p) => {
            const response = await fetch(`/api/patients/${p.id}/tasks`);
            const data = (await response.json()) as { tasks: TaskSummary[] };
            return [p.id, openTaskCount(data.tasks)] as const;
          }),
        );
        if (!cancelled) setOpenTasks(Object.fromEntries(entries));
      } catch (error) {
        console.error("failed to poll patient task counts", error);
      }
    }

    pollTasks();
    const interval = setInterval(pollTasks, TASKS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [patients]);

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-4 py-10 md:px-6">
      <h1 className="text-[26px] font-bold tracking-tight">Patients</h1>
      <p className="mt-1 text-[13.5px] text-muted-foreground">
        {loaded ? `${patients.length} enrolled in remote monitoring` : "Loading enrolled patients…"}
      </p>

      <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {!loaded ? (
          Array.from({ length: 6 }).map((_, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <Skeleton key={i} className="h-[132px] w-full rounded-2xl" />
          ))
        ) : patients.length === 0 ? (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            No patients found on care-loop-fhir-server.
          </p>
        ) : (
          patients.map((patient) => {
            const count = openTasks[patient.id];
            const summary =
              count === undefined ? "…" : count === 0 ? "No open tasks" : `${count} open task${count === 1 ? "" : "s"}`;
            return (
              <button
                key={patient.id}
                type="button"
                onClick={() => onSelect(patient)}
                className="group flex flex-col rounded-2xl border border-border bg-background p-4 text-left transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-foreground/40 hover:shadow-[0_10px_26px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-bold text-background">
                    {initials(patient.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold">{patient.name}</div>
                    <div className="truncate text-[11.5px] text-muted-foreground">
                      {patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : "Unknown sex"}
                      {patient.birthDate ? ` · DOB ${patient.birthDate}` : ""}
                    </div>
                  </div>
                </div>
                <div className="mt-2 font-mono text-[10.5px] text-muted-foreground/60">
                  Patient/{patient.id}
                </div>
                <div className="mt-3.5 flex items-center justify-between border-t border-border/70 pt-2.5">
                  <span className="text-[11.5px] text-muted-foreground">{summary}</span>
                  <ArrowRight className="size-3.5 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
