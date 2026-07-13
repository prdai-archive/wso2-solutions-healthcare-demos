"use client";

import type {
  AllergySummary,
  ConditionSummary,
  MedicationSummary,
} from "@/app/api/patients/[id]/history/route";

import { useEffect, useState } from "react";

import { FhirButton } from "@/components/resources/fhir-drawer";
import { Skeleton } from "@/components/ui/skeleton";

const HISTORY_POLL_INTERVAL_MS = 4_000;

interface HistoryData {
  conditions: ConditionSummary[];
  medications: MedicationSummary[];
  allergies: AllergySummary[];
}

function HistorySection<T extends { id: string; raw: unknown }>({
  title,
  resourceType,
  items,
  renderItem,
  emptyLabel,
}: {
  title: string;
  resourceType: string;
  items: T[];
  renderItem: (item: T) => { primary: React.ReactNode; secondary?: React.ReactNode };
  emptyLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[12.5px] font-semibold">{title}</h3>
        <span className="font-mono text-[10px] text-muted-foreground/50">{resourceType}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => {
            const { primary, secondary } = renderItem(item);
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px]">{primary}</div>
                  {secondary ? (
                    <div className="truncate text-[11px] text-muted-foreground">{secondary}</div>
                  ) : null}
                </div>
                <FhirButton resourcePath={`${resourceType}/${item.id}`} raw={item.raw} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function PatientHistory({ patientId }: { patientId: string }) {
  const [history, setHistory] = useState<HistoryData>({
    conditions: [],
    medications: [],
    allergies: [],
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    async function poll() {
      try {
        const response = await fetch(`/api/patients/${patientId}/history`);
        const data = (await response.json()) as HistoryData;
        if (!cancelled) setHistory(data);
      } catch (error) {
        console.error("failed to poll patient history", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, HISTORY_POLL_INTERVAL_MS);
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

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <HistorySection
        title="Conditions"
        resourceType="Condition"
        items={history.conditions}
        emptyLabel="None recorded."
        renderItem={(condition) => ({
          primary: condition.code,
          secondary: condition.onsetDateTime
            ? `since ${new Date(condition.onsetDateTime).toLocaleDateString()}`
            : undefined,
        })}
      />
      <HistorySection
        title="Medications"
        resourceType="MedicationRequest"
        items={history.medications}
        emptyLabel="None recorded."
        renderItem={(medication) => ({
          primary: medication.medication,
          secondary: medication.status ?? undefined,
        })}
      />
      <HistorySection
        title="Allergies"
        resourceType="AllergyIntolerance"
        items={history.allergies}
        emptyLabel="None recorded."
        renderItem={(allergy) => ({
          primary: allergy.substance,
          secondary: allergy.reaction ? `reaction: ${allergy.reaction}` : undefined,
        })}
      />
    </div>
  );
}
