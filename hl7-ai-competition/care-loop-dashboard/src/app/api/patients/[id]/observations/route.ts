import type { Bundle, Observation } from "fhir/r4";

import process from "node:process";

import { Client } from "fhir-kit-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export interface ObservationSummary {
  id: string;
  code: string;
  value: string | null;
  unit: string | null;
  effectiveDateTime: string | null;
}

function toObservationSummary(observation: Observation): ObservationSummary {
  const code =
    observation.code.coding?.[0]?.display ?? observation.code.text ?? "";
  const quantity = observation.valueQuantity;

  return {
    id: observation.id ?? "",
    code,
    value: quantity?.value !== undefined ? String(quantity.value) : null,
    unit: quantity?.unit ?? null,
    effectiveDateTime: observation.effectiveDateTime ?? null,
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
        _count: 100,
      },
    })) as unknown as Bundle<Observation>;

    const observations = (bundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter((resource): resource is Observation => resource !== undefined)
      .map(toObservationSummary);

    return NextResponse.json({ observations });
  } catch (error) {
    console.error(
      "failed to fetch observations from care-loop-fhir-server",
      error,
    );
    return NextResponse.json({ observations: [] });
  }
}
