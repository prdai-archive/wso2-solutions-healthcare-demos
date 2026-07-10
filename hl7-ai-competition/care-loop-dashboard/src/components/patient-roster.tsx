"use client";

import type { OpsPatient } from "@/app/api/patients/route";
import type { Run } from "@/lib/runs";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { STAGE_DEFS } from "@/lib/stages";
import { cn } from "@/lib/utils";

const PATIENTS_POLL_INTERVAL_MS = 15_000;
const PROGRESS_POLL_INTERVAL_MS = 4_000;
const TOTAL_STAGES = STAGE_DEFS.length;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}

function latestRunProgress(runs: Run[]): number {
  // segmentRuns returns newest-first.
  const latest = runs[0];
  if (!latest) return 0;
  let last = -1;
  latest.stages.forEach((s, i) => {
    if (s.status === "done" || s.status === "active") last = i;
  });
  return Math.max(0, last) / (TOTAL_STAGES - 1);
}

export function PatientRoster({
  selectedId,
  onSelect,
}: {
  selectedId: string | undefined;
  onSelect: (patient: OpsPatient) => void;
}) {
  const [patients, setPatients] = useState<OpsPatient[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});

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
    if (!selectedId && patients.length > 0 && patients[0]) {
      onSelect(patients[0]);
    }
    // eslint-disable-next-line react/exhaustive-deps
  }, [patients]);

  useEffect(() => {
    if (patients.length === 0) return;
    let cancelled = false;

    async function pollProgress() {
      try {
        const entries = await Promise.all(
          patients.map(async (p) => {
            const response = await fetch(`/api/patients/${p.id}/runs`);
            const data = (await response.json()) as { runs: Run[] };
            return [p.id, latestRunProgress(data.runs)] as const;
          }),
        );
        if (!cancelled) setProgress(Object.fromEntries(entries));
      } catch (error) {
        console.error("failed to poll patient progress", error);
      }
    }

    pollProgress();
    const interval = setInterval(pollProgress, PROGRESS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [patients]);

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Patients (care-loop-fhir-server)
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 p-0">
        <ScrollArea className="h-full px-3 pb-3">
          {!loaded ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : patients.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              No patients found on care-loop-fhir-server.
            </p>
          ) : (
            <div className="space-y-1">
              {patients.map((patient) => {
                const selected = selectedId === patient.id;
                return (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => onSelect(patient)}
                    className={cn(
                      "w-full rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted/60",
                      selected && "bg-muted",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg text-[10.5px] font-bold",
                          selected ? "bg-foreground text-background" : "bg-foreground/5 text-muted-foreground",
                        )}
                      >
                        {initials(patient.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium">{patient.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : ""}
                          {patient.birthDate ? ` · ${patient.birthDate}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-foreground/[0.07]">
                      <div
                        className="h-full rounded-full bg-foreground transition-[width]"
                        style={{ width: `${Math.round((progress[patient.id] ?? 0) * 100)}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
