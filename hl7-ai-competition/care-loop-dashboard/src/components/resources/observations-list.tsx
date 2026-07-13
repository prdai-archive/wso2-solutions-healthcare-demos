"use client";

import type { ObservationSummary } from "@/app/api/patients/[id]/observations/route";

import { useEffect, useState } from "react";

import { FhirCard } from "@/components/resources/fhir-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

const OBSERVATIONS_POLL_INTERVAL_MS = 4_000;

export type ObservationDto = ObservationSummary;

export function ObservationsList({
  patientId,
  focusedRefs,
}: {
  patientId: string;
  focusedRefs?: Set<string> | null;
}) {
  const [observations, setObservations] = useState<ObservationDto[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    async function poll() {
      try {
        const response = await fetch(`/api/patients/${patientId}/observations`);
        const data = (await response.json()) as { observations: ObservationDto[] };
        if (!cancelled) setObservations(data.observations);
      } catch (error) {
        console.error("failed to poll observations", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, OBSERVATIONS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [patientId]);

  if (!loaded) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (observations.length === 0) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        No observations recorded yet for this patient.
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        {observations.map((observation) => (
          <FhirCard
            key={observation.id}
            title={observation.code}
            subtitle={
              observation.effectiveDateTime
                ? new Date(observation.effectiveDateTime).toLocaleString()
                : undefined
            }
            resourcePath={`Observation/${observation.id}`}
            raw={observation.raw}
            highlighted={focusedRefs?.has(`Observation/${observation.id}`)}
          >
            <p className="text-sm">
              {observation.value !== null
                ? `${observation.value}${observation.unit ? ` ${observation.unit}` : ""}`
                : "No value recorded"}
            </p>
          </FhirCard>
        ))}
      </div>
    </ScrollArea>
  );
}
