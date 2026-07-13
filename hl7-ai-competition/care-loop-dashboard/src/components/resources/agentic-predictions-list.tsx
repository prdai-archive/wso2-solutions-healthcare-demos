"use client";

import type { RiskAssessmentSummary } from "@/app/api/patients/[id]/risk-assessments/route";

import { FhirCard } from "@/components/resources/fhir-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

export type AgenticRiskAssessmentDto = RiskAssessmentSummary;

// Data is fetched once at the page level (shared with MlPredictionsList and
// AlertsList's ML/Agent columns) rather than each consumer polling the same
// /risk-assessments route independently.
export function AgenticPredictionsList({
  riskAssessments,
  loaded,
  focusedRefs,
}: {
  riskAssessments: AgenticRiskAssessmentDto[];
  loaded: boolean;
  focusedRefs?: Set<string> | null;
}) {
  if (!loaded) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (riskAssessments.length === 0) {
    return (
      <p className="p-3 text-sm text-muted-foreground">
        No agentic risk assessments recorded yet for this patient.
      </p>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2">
        {riskAssessments.map((riskAssessment) => (
          <FhirCard
            key={riskAssessment.id}
            title={riskAssessment.method ?? "Risk assessment"}
            subtitle={
              riskAssessment.occurrenceDateTime
                ? new Date(riskAssessment.occurrenceDateTime).toLocaleString()
                : undefined
            }
            resourcePath={`RiskAssessment/${riskAssessment.id}`}
            raw={riskAssessment.raw}
            highlighted={focusedRefs?.has(`RiskAssessment/${riskAssessment.id}`)}
          >
            <div className="space-y-2.5">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {riskAssessment.note ?? "No agentic reasoning recorded."}
              </p>
              {riskAssessment.predictions.length > 0 ? (
                <div className="space-y-1.5 border-t pt-2">
                  {riskAssessment.predictions.map((prediction, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <div key={index} className="text-[11.5px]">
                      <span className="font-medium text-muted-foreground">
                        {prediction.probability !== null
                          ? `${Math.round(prediction.probability * 100)}% · `
                          : ""}
                      </span>
                      <span>{prediction.rationale ?? "No rationale recorded."}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </FhirCard>
        ))}
      </div>
    </ScrollArea>
  );
}
