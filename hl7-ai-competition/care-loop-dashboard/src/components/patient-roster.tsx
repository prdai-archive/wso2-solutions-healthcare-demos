"use client";

import type { OpsPatient } from "@/app/api/patients/route";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 15_000;

export function PatientRoster({
  selectedId,
  onSelect,
}: {
  selectedId: string | undefined;
  onSelect: (patient: OpsPatient) => void;
}) {
  const [patients, setPatients] = useState<OpsPatient[]>([]);
  const [loaded, setLoaded] = useState(false);

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
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedId && patients.length > 0 && patients[0]) {
      onSelect(patients[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : patients.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              No patients found on care-loop-fhir-server.
            </p>
          ) : (
            <div className="space-y-1">
              {patients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => onSelect(patient)}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    selectedId === patient.id && "bg-muted",
                  )}
                >
                  <div className="font-medium">{patient.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {patient.id}
                    {patient.gender ? ` · ${patient.gender}` : ""}
                    {patient.birthDate ? ` · ${patient.birthDate}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
