import type { Bundle, RiskAssessment as FhirRiskAssessment } from "fhir/r4";

import process from "node:process";

import { Client } from "fhir-kit-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// care-loop-analysis-service saves one RiskAssessment per source (ML from
// care-loop-heart-risk-service, agentic from care-loop-ai-service) rather than
// a single merged resource — method.text is how we tell them apart here.
export type RiskSource = "ml" | "agentic" | "unknown";

export interface OpsRiskAssessment {
  id: string;
  source: RiskSource;
  method: string | undefined;
  reasoning: string | undefined;
  probability: number | undefined;
  rationale: string | undefined;
}

function sourceFor(method: string | undefined): RiskSource {
  if (!method) return "unknown";
  if (method.includes("heart-risk-service")) return "ml";
  if (method.includes("ai-service")) return "agentic";
  return "unknown";
}

function toOpsRiskAssessment(riskAssessment: FhirRiskAssessment): OpsRiskAssessment {
  const method = riskAssessment.method?.text;
  const prediction = riskAssessment.prediction?.[0];
  return {
    id: riskAssessment.id ?? "",
    source: sourceFor(method),
    method,
    reasoning: riskAssessment.note?.map((n) => n.text).join(" "),
    probability: prediction?.probabilityDecimal,
    rationale: prediction?.rationale,
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
        _count: 20,
      },
    })) as unknown as Bundle<FhirRiskAssessment>;

    const riskAssessments = (bundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter(
        (resource): resource is FhirRiskAssessment => resource !== undefined,
      )
      .map(toOpsRiskAssessment);

    return NextResponse.json({ riskAssessments });
  } catch (error) {
    console.error(
      `failed to fetch RiskAssessments for patient ${id} from care-loop-fhir-server`,
      error,
    );
    return NextResponse.json({ riskAssessments: [] });
  }
}
