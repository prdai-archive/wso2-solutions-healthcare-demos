#!/usr/bin/env bun
// Seeds scripts/seed-data/patient.json into apple-healthkit-simulator and OpenEMR's FHIR API; skips a target if its patient already exists.

import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const HEALTHKIT_URL = process.env.HEALTHKIT_URL ?? "http://localhost:8000";
const OPENEMR_FHIR_URL = process.env.OPENEMR_FHIR_URL ?? "http://localhost:3001/apis/default/fhir";
const SEED_ENV_FILE = process.env.SEED_ENV_FILE ?? join(ROOT, ".fhir-seed.env");
const SEED_DATA_FILE = process.env.SEED_DATA_FILE ?? join(ROOT, "scripts/seed-data/patient.json");

type QuantitySample = Record<string, unknown>;
type SeedData = {
  patient: { mrn: string; given_name: string; family_name: string; date_of_birth: string };
  healthkit: {
    characteristics: Record<string, unknown>;
    quantity_samples: QuantitySample[];
    category_samples: Record<string, unknown>[];
    blood_pressure_correlations: Array<{
      source_name: string;
      start_date: string;
      end_date: string;
      systolic: { value: number; unit: string };
      diastolic: { value: number; unit: string };
    }>;
    workouts: Record<string, unknown>[];
    activity_summaries: Record<string, unknown>[];
  };
  openemr: {
    patient: Record<string, unknown>;
  };
};

type HealthkitPatient = { id: number; uuid: string; mrn: string; openemr_patient_uuid: string | null };

function log(message: string): void {
  console.log(`[seed] ${message}`);
}

async function waitForHealthy(url: string, label: string, timeoutMs = 120_000): Promise<void> {
  const start = performance.now();
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        log(`${label} is up.`);
        return;
      }
    } catch {
      // keep polling
    }
    if (performance.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for ${label} at ${url}`);
    }
    await Bun.sleep(2000);
  }
}

function loadSeedToken(path: string): string {
  const contents = Bun.file(path);
  return contents
    .text()
    .then((text) => {
      const line = text.split("\n").find((l) => l.startsWith("FHIR_SERVER_ACCESS_TOKEN="));
      if (!line) {
        throw new Error(`No FHIR_SERVER_ACCESS_TOKEN found in ${path}. Run 'make seed' (not seed.ts directly).`);
      }
      return line.slice("FHIR_SERVER_ACCESS_TOKEN=".length).trim();
    }) as unknown as string;
}

// --- apple-healthkit-simulator -------------------------------------------

async function healthkitPost<T>(path: string, body: unknown): Promise<T[]> {
  const res = await fetch(`${HEALTHKIT_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(Array.isArray(body) ? body : [body]),
  });
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T[];
}

async function findPatientByMrn(mrn: string): Promise<HealthkitPatient | null> {
  const res = await fetch(`${HEALTHKIT_URL}/patients?limit=1000`);
  if (!res.ok) {
    throw new Error(`GET /patients failed: ${res.status} ${await res.text()}`);
  }
  const patients = (await res.json()) as HealthkitPatient[];
  return patients.find((p) => p.mrn === mrn) ?? null;
}

async function seedHealthkit(data: SeedData): Promise<HealthkitPatient> {
  const existing = await findPatientByMrn(data.patient.mrn);
  if (existing) {
    log(`apple-healthkit-simulator already has patient ${data.patient.mrn} (id=${existing.id}); skipping.`);
    return existing;
  }

  const [patient] = await healthkitPost<HealthkitPatient>("/patients", {
    mrn: data.patient.mrn,
    given_name: data.patient.given_name,
    family_name: data.patient.family_name,
    date_of_birth: data.patient.date_of_birth,
  });
  log(`created patient id=${patient.id} (${data.patient.mrn})`);

  await healthkitPost("/characteristics", { ...data.healthkit.characteristics, patient_id: patient.id });
  log(`seeded characteristics`);

  const quantitySamples = data.healthkit.quantity_samples.map((s) => ({ ...s, patient_id: patient.id }));
  await healthkitPost("/quantity-samples", quantitySamples);
  log(`seeded ${quantitySamples.length} quantity samples`);

  await healthkitPost("/category-samples", data.healthkit.category_samples.map((s) => ({ ...s, patient_id: patient.id })));
  log(`seeded ${data.healthkit.category_samples.length} category samples`);

  for (const bp of data.healthkit.blood_pressure_correlations) {
    const [correlation] = await healthkitPost<{ id: number }>("/correlations", {
      patient_id: patient.id,
      source_name: bp.source_name,
      correlation_type: "HKCorrelationTypeIdentifierBloodPressure",
      start_date: bp.start_date,
      end_date: bp.end_date,
    });
    await healthkitPost("/quantity-samples", [
      {
        patient_id: patient.id,
        correlation_id: correlation.id,
        source_name: bp.source_name,
        quantity_type: "HKQuantityTypeIdentifierBloodPressureSystolic",
        value: bp.systolic.value,
        unit: bp.systolic.unit,
        start_date: bp.start_date,
        end_date: bp.end_date,
      },
      {
        patient_id: patient.id,
        correlation_id: correlation.id,
        source_name: bp.source_name,
        quantity_type: "HKQuantityTypeIdentifierBloodPressureDiastolic",
        value: bp.diastolic.value,
        unit: bp.diastolic.unit,
        start_date: bp.start_date,
        end_date: bp.end_date,
      },
    ]);
  }
  log(`seeded ${data.healthkit.blood_pressure_correlations.length} blood pressure correlations`);

  await healthkitPost("/workouts", data.healthkit.workouts.map((w) => ({ ...w, patient_id: patient.id })));
  log(`seeded ${data.healthkit.workouts.length} workouts`);

  await healthkitPost(
    "/activity-summaries",
    data.healthkit.activity_summaries.map((s) => ({ ...s, patient_id: patient.id })),
  );
  log(`seeded ${data.healthkit.activity_summaries.length} activity summaries`);
  return patient;
}

// --- OpenEMR FHIR ----------------------------------------------------------

async function fhirFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${OPENEMR_FHIR_URL}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/fhir+json",
      accept: "application/fhir+json",
      ...(init?.headers ?? {}),
    },
  });
}

// Only Patient supports FHIR create on this OpenEMR version; it also discards the identifier we send, so its returned uuid is the only way back to this record.
async function createOpenemrPatient(resource: Record<string, unknown>, token: string): Promise<string> {
  const res = await fhirFetch("/Patient", token, { method: "POST", body: JSON.stringify(resource) });
  if (!res.ok) {
    throw new Error(`POST Patient failed: ${res.status} ${await res.text()}`);
  }
  const created = (await res.json()) as { uuid: string };
  return created.uuid;
}

async function linkOpenemrPatient(patientUuid: string, openemrPatientUuid: string): Promise<void> {
  const res = await fetch(`${HEALTHKIT_URL}/patients/${patientUuid}/openemr-link`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ openemr_patient_uuid: openemrPatientUuid }),
  });
  if (!res.ok) {
    throw new Error(`PATCH openemr-link failed: ${res.status} ${await res.text()}`);
  }
}

async function seedOpenemr(data: SeedData, patient: HealthkitPatient, token: string): Promise<void> {
  if (patient.openemr_patient_uuid) {
    log(`OpenEMR already has Patient/${patient.openemr_patient_uuid} for ${data.patient.mrn}; skipping.`);
    return;
  }

  const openemrPatientUuid = await createOpenemrPatient(data.openemr.patient, token);
  log(`created OpenEMR Patient/${openemrPatientUuid}`);
  await linkOpenemrPatient(patient.uuid, openemrPatientUuid);
}

// --- main -------------------------------------------------------------------

async function main(): Promise<void> {
  const data = (await Bun.file(SEED_DATA_FILE).json()) as SeedData;

  await waitForHealthy(`${HEALTHKIT_URL}/health`, "apple-healthkit-simulator");
  const patient = await seedHealthkit(data);

  const token = await loadSeedToken(SEED_ENV_FILE);
  await seedOpenemr(data, patient, token);

  log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
