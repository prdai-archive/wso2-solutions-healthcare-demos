import type {
  AllergyIntolerance,
  Bundle,
  Condition,
  MedicationRequest,
} from "fhir/r4";

import process from "node:process";

import { Client } from "fhir-kit-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export interface ConditionSummary {
  id: string;
  code: string;
  onsetDateTime: string | null;
}

export interface MedicationSummary {
  id: string;
  medication: string;
  status: string | null;
}

export interface AllergySummary {
  id: string;
  substance: string;
  reaction: string | null;
}

function toConditionSummary(condition: Condition): ConditionSummary {
  const code =
    condition.code?.coding?.[0]?.display ?? condition.code?.text ?? "";

  return {
    id: condition.id ?? "",
    code,
    onsetDateTime: condition.onsetDateTime ?? null,
  };
}

function toMedicationSummary(request: MedicationRequest): MedicationSummary {
  const medication =
    request.medicationCodeableConcept?.coding?.[0]?.display ??
    request.medicationCodeableConcept?.text ??
    request.medicationReference?.display ??
    "";

  return {
    id: request.id ?? "",
    medication,
    status: request.status ?? null,
  };
}

function toAllergySummary(allergy: AllergyIntolerance): AllergySummary {
  const substance =
    allergy.code?.coding?.[0]?.display ?? allergy.code?.text ?? "";
  const reaction =
    allergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display ?? null;

  return {
    id: allergy.id ?? "",
    substance,
    reaction,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl =
    process.env.EHR_FHIR_SERVER_URL ?? "http://localhost:9090/fhir/r4";

  try {
    const client = new Client({ baseUrl });

    const [conditionBundle, medicationBundle, allergyBundle] =
      await Promise.all([
        client.resourceSearch({
          resourceType: "Condition",
          searchParams: { patient: `Patient/${id}`, _count: 50 },
        }) as unknown as Promise<Bundle<Condition>>,
        client.resourceSearch({
          resourceType: "MedicationRequest",
          searchParams: { patient: `Patient/${id}`, _count: 50 },
        }) as unknown as Promise<Bundle<MedicationRequest>>,
        client.resourceSearch({
          resourceType: "AllergyIntolerance",
          searchParams: { patient: `Patient/${id}`, _count: 50 },
        }) as unknown as Promise<Bundle<AllergyIntolerance>>,
      ]);

    const conditions = (conditionBundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter((resource): resource is Condition => resource !== undefined)
      .map(toConditionSummary);

    const medications = (medicationBundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter(
        (resource): resource is MedicationRequest => resource !== undefined,
      )
      .map(toMedicationSummary);

    const allergies = (allergyBundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter(
        (resource): resource is AllergyIntolerance => resource !== undefined,
      )
      .map(toAllergySummary);

    return NextResponse.json({ conditions, medications, allergies });
  } catch (error) {
    console.error("failed to fetch patient history from ehr-fhir-server", error);
    return NextResponse.json({ conditions: [], medications: [], allergies: [] });
  }
}
