"use client";

import type { QuestionnaireResponseSummary } from "@/app/api/patients/[id]/questionnaire-responses/route";

import { useEffect, useState } from "react";

import { FhirCard } from "@/components/resources/fhir-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

const QUESTIONNAIRE_RESPONSES_POLL_INTERVAL_MS = 4_000;

export type QuestionnaireResponseDto = QuestionnaireResponseSummary;

export function QuestionnaireResponsesList({
  patientId,
  focusedRefs,
}: {
  patientId: string;
  focusedRefs?: Set<string> | null;
}) {
  const [responses, setResponses] = useState<QuestionnaireResponseDto[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    async function poll() {
      try {
        const response = await fetch(
          `/api/patients/${patientId}/questionnaire-responses`,
        );
        const data = (await response.json()) as {
          responses: QuestionnaireResponseDto[];
        };
        if (!cancelled) setResponses(data.responses);
      } catch (error) {
        console.error("failed to poll questionnaire responses", error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    poll();
    const interval = setInterval(poll, QUESTIONNAIRE_RESPONSES_POLL_INTERVAL_MS);
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
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        No questionnaire responses recorded yet for this patient.
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        {responses.map((response) => (
          <FhirCard
            key={response.id}
            title={response.questionnaireTitle ?? "Untitled questionnaire"}
            subtitle={
              response.authored
                ? new Date(response.authored).toLocaleString()
                : undefined
            }
            resourcePath={`QuestionnaireResponse/${response.id}`}
            raw={response.raw}
            highlighted={focusedRefs?.has(`QuestionnaireResponse/${response.id}`)}
          >
            {response.answers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No answers recorded.</p>
            ) : (
              <dl className="space-y-1.5">
                {response.answers.map((answer, index) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <div key={index}>
                    <dt className="text-[11px] text-muted-foreground">
                      {answer.question}
                    </dt>
                    <dd className="text-sm">{answer.answer}</dd>
                  </div>
                ))}
              </dl>
            )}
          </FhirCard>
        ))}
      </div>
    </ScrollArea>
  );
}
