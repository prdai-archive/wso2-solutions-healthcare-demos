"use client";

import { useEffect, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

const HISTORY_POLL_INTERVAL_MS = 4_000;

interface ConditionSummary {
  id: string;
  code: string;
  onsetDateTime: string | null;
}

interface MedicationSummary {
  id: string;
  medication: string;
  status: string | null;
}

interface AllergySummary {
  id: string;
  substance: string;
  reaction: string | null;
}

interface HistoryData {
  conditions: ConditionSummary[];
  medications: MedicationSummary[];
  allergies: AllergySummary[];
}

function HistorySection<T extends { id: string }>({
  title,
  items,
  renderItem,
  emptyLabel,
}: {
  title: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  emptyLabel: string;
}) {
  return (
    <div>
      <h3 className="mb-1.5 text-[12px] font-semibold text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="text-sm">
              {renderItem(item)}
            </li>
          ))}
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
    <ScrollArea className="h-full">
      <div className="space-y-4">
        <HistorySection
          title="Conditions"
          items={history.conditions}
          emptyLabel="No conditions recorded for this patient."
          renderItem={(condition) => (
            <>
              {condition.code}
              {condition.onsetDateTime ? (
                <span className="ml-1.5 text-[11px] text-muted-foreground">
                  since {new Date(condition.onsetDateTime).toLocaleDateString()}
                </span>
              ) : null}
            </>
          )}
        />
        <HistorySection
          title="Medications"
          items={history.medications}
          emptyLabel="No medications recorded for this patient."
          renderItem={(medication) => (
            <>
              {medication.medication}
              {medication.status ? (
                <span className="ml-1.5 text-[11px] text-muted-foreground">
                  {medication.status}
                </span>
              ) : null}
            </>
          )}
        />
        <HistorySection
          title="Allergies"
          items={history.allergies}
          emptyLabel="No allergies recorded for this patient."
          renderItem={(allergy) => (
            <>
              {allergy.substance}
              {allergy.reaction ? (
                <span className="ml-1.5 text-[11px] text-muted-foreground">
                  reaction: {allergy.reaction}
                </span>
              ) : null}
            </>
          )}
        />
      </div>
    </ScrollArea>
  );
}
