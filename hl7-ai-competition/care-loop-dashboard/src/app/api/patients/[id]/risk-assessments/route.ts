import type { Bundle, RiskAssessment } from "fhir/r4";

import process from "node:process";

import { Client } from "fhir-kit-client";
import { NextResponse } from "next/server";

import { degradedResponse } from "@/lib/api-degraded";

export const runtime = "nodejs";

export interface RiskAssessmentPredictionSummary {
  probability: number | null;
  rationale: string | null;
}

export interface RiskAssessmentSummary {
  id: string;
  method: string | null;
  note: string | null;
  occurrenceDateTime: string | null;
  predictions: RiskAssessmentPredictionSummary[];
  basis: string[];
  raw: RiskAssessment;
}

function toRiskAssessmentSummary(
  assessment: RiskAssessment,
): RiskAssessmentSummary {
  const note =
    assessment.note && assessment.note.length > 0
      ? assessment.note
          .map((annotation) => annotation.text)
          .filter(Boolean)
          .join(" ")
      : null;

  const predictions = (assessment.prediction ?? []).map((prediction) => ({
    probability: prediction.probabilityDecimal ?? null,
    rationale: prediction.rationale ?? null,
  }));

  const basis = (assessment.basis ?? [])
    .map((reference) => reference.reference)
    .filter((reference): reference is string => Boolean(reference));

  return {
    id: assessment.id ?? "",
    method: assessment.method?.text ?? null,
    note,
    occurrenceDateTime: assessment.occurrenceDateTime ?? assessment.meta?.lastUpdated ?? null,
    predictions,
    basis,
    raw: assessment,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl =
    process.env.CARE_LOOP_FHIR_SERVER_URL ?? "http://localhost:9091/fhir";

  try {
    const client = new Client({ baseUrl });
    const bundle = (await client.resourceSearch({
      resourceType: "RiskAssessment",
      searchParams: {
        subject: `Patient/${id}`,
        _sort: "-_lastUpdated",
        _count: 50,
      },
    })) as unknown as Bundle<RiskAssessment>;

    const riskAssessments = (bundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter((resource): resource is RiskAssessment => resource !== undefined)
      .map(toRiskAssessmentSummary);

    return NextResponse.json({ riskAssessments });
  } catch (error) {
    console.error(
      "failed to fetch risk assessments from care-loop-fhir-server",
      error,
    );
    return degradedResponse({ riskAssessments: [] });
  }
}
