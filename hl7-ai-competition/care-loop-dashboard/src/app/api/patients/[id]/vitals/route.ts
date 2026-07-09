import type { Bundle, Observation as FhirObservation } from "fhir/r4";

import process from "node:process";

import { Client } from "fhir-kit-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export interface OpsVital {
  id: string;
  code: string | undefined;
  value: number | undefined;
  unit: string | undefined;
  effectiveDateTime: string | undefined;
}

function toOpsVital(observation: FhirObservation): OpsVital {
  const valueQuantity =
    "valueQuantity" in observation ? observation.valueQuantity : undefined;
  return {
    id: observation.id ?? "",
    code: observation.code?.coding?.[0]?.display ?? observation.code?.text,
    value: valueQuantity?.value,
    unit: valueQuantity?.unit,
    effectiveDateTime:
      "effectiveDateTime" in observation
        ? observation.effectiveDateTime
        : undefined,
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
      resourceType: "Observation",
      searchParams: {
        subject: `Patient/${id}`,
        _sort: "-date",
        _count: 20,
      },
    })) as unknown as Bundle<FhirObservation>;

    const vitals = (bundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter((resource): resource is FhirObservation => resource !== undefined)
      .map(toOpsVital);

    return NextResponse.json({ vitals });
  } catch (error) {
    console.error(
      `failed to fetch Observations for patient ${id} from care-loop-fhir-server`,
      error,
    );
    return NextResponse.json({ vitals: [] });
  }
}
