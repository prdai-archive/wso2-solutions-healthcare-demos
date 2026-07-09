import type { Bundle, Patient as FhirPatient } from "fhir/r4";

import process from "node:process";

import { Client } from "fhir-kit-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export interface OpsPatient {
  id: string;
  name: string;
  birthDate: string | undefined;
  gender: string | undefined;
}

function formatName(patient: FhirPatient): string {
  const name = patient.name?.[0];
  if (!name) return "Unknown patient";
  return [...(name.given ?? []), name.family].filter(Boolean).join(" ");
}

function toOpsPatient(patient: FhirPatient): OpsPatient {
  return {
    id: patient.id ?? "",
    name: formatName(patient),
    birthDate: patient.birthDate,
    gender: patient.gender,
  };
}

export async function GET() {
  const baseUrl =
    process.env.CARE_LOOP_FHIR_SERVER_URL ?? "http://localhost:9091/fhir";

  try {
    const client = new Client({ baseUrl });
    const bundle = (await client.resourceSearch({
      resourceType: "Patient",
      searchParams: { _count: 200 },
    })) as unknown as Bundle<FhirPatient>;

    const patients = (bundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter((resource): resource is FhirPatient => resource !== undefined)
      .map(toOpsPatient);

    return NextResponse.json({ patients });
  } catch (error) {
    console.error("failed to fetch patients from care-loop-fhir-server", error);
    return NextResponse.json({ patients: [] });
  }
}
