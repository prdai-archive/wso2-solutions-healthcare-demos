#!/usr/bin/env bun
// Seeds scripts/seed-data/patients.json into apple-healthkit-simulator and wso2/fhir-server; skips a target patient that already exists.

import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

const HEALTHKIT_URL = process.env.HEALTHKIT_URL ?? "http://localhost:8000";
const FHIR_SERVER_URL = process.env.FHIR_SERVER_URL ?? "http://localhost:9090/fhir/r4";
const SEED_DATA_FILE = process.env.SEED_DATA_FILE ?? join(ROOT, "scripts/seed-data/patients.json");

type QuantitySample = Record<string, unknown>;
type SeedPatient = {
  patient: { mrn: string; given_name: string; family_name: string; date_of_birth: string; vitals_profile: string };
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
  fhir: {
    patient: Record<string, unknown>;
    encounter: Record<string, unknown>;
    conditions: Record<string, unknown>[];
    observations: Record<string, unknown>[];
  };
};

type HealthkitPatient = { id: number; uuid: string; mrn: string; fhir_patient_id: string | null };

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

async function seedHealthkit(seed: SeedPatient): Promise<HealthkitPatient> {
  const existing = await findPatientByMrn(seed.patient.mrn);
  if (existing) {
    log(`apple-healthkit-simulator already has patient ${seed.patient.mrn} (id=${existing.id}); skipping.`);
    return existing;
  }

  const [patient] = await healthkitPost<HealthkitPatient>("/patients", {
    mrn: seed.patient.mrn,
    given_name: seed.patient.given_name,
    family_name: seed.patient.family_name,
    date_of_birth: seed.patient.date_of_birth,
  });
  log(`created patient id=${patient.id} (${seed.patient.mrn})`);

  await healthkitPost("/characteristics", { ...seed.healthkit.characteristics, patient_id: patient.id });

  const quantitySamples = seed.healthkit.quantity_samples.map((s) => ({ ...s, patient_id: patient.id }));
  await healthkitPost("/quantity-samples", quantitySamples);

  await healthkitPost(
    "/category-samples",
    seed.healthkit.category_samples.map((s) => ({ ...s, patient_id: patient.id })),
  );

  for (const bp of seed.healthkit.blood_pressure_correlations) {
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

  await healthkitPost("/workouts", seed.healthkit.workouts.map((w) => ({ ...w, patient_id: patient.id })));

  await healthkitPost(
    "/activity-summaries",
    seed.healthkit.activity_summaries.map((s) => ({ ...s, patient_id: patient.id })),
  );

  log(
    `seeded ${quantitySamples.length} quantity samples, ${seed.healthkit.category_samples.length} category samples, ` +
      `${seed.healthkit.blood_pressure_correlations.length} BP correlations, ${seed.healthkit.workouts.length} workouts, ` +
      `${seed.healthkit.activity_summaries.length} activity summaries`,
  );
  return patient;
}

// --- wso2/fhir-server --------------------------------------------------------

async function fhirCreate<T extends { id: string }>(resourceType: string, resource: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${FHIR_SERVER_URL}/${resourceType}`, {
    method: "POST",
    headers: { "content-type": "application/fhir+json" },
    body: JSON.stringify(resource),
  });
  if (!res.ok) {
    throw new Error(`POST ${resourceType} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function linkFhirPatient(patientUuid: string, fhirPatientId: string): Promise<void> {
  const res = await fetch(`${HEALTHKIT_URL}/patients/${patientUuid}/fhir-link`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fhir_patient_id: fhirPatientId }),
  });
  if (!res.ok) {
    throw new Error(`PATCH fhir-link failed: ${res.status} ${await res.text()}`);
  }
}

async function seedFhir(seed: SeedPatient, patient: HealthkitPatient): Promise<void> {
  if (patient.fhir_patient_id) {
    log(`fhir-server already has Patient/${patient.fhir_patient_id} for ${seed.patient.mrn}; skipping.`);
    return;
  }

  const fhirPatient = await fhirCreate<{ id: string }>("Patient", seed.fhir.patient);
  log(`created fhir-server Patient/${fhirPatient.id}`);
  const subject = { reference: `Patient/${fhirPatient.id}` };

  const encounter = await fhirCreate<{ id: string }>("Encounter", { ...seed.fhir.encounter, subject });
  log(`created fhir-server Encounter/${encounter.id}`);

  for (const condition of seed.fhir.conditions) {
    const created = await fhirCreate<{ id: string }>("Condition", { ...condition, subject });
    log(`created fhir-server Condition/${created.id}`);
  }

  for (const observation of seed.fhir.observations) {
    const created = await fhirCreate<{ id: string }>("Observation", {
      ...observation,
      subject,
      encounter: { reference: `Encounter/${encounter.id}` },
    });
    log(`created fhir-server Observation/${created.id}`);
  }

  await linkFhirPatient(patient.uuid, fhirPatient.id);
}

// --- main -------------------------------------------------------------------

async function main(): Promise<void> {
  const patients = (await Bun.file(SEED_DATA_FILE).json()) as SeedPatient[];

  await waitForHealthy(`${HEALTHKIT_URL}/health`, "apple-healthkit-simulator");
  await waitForHealthy(`${FHIR_SERVER_URL}/metadata`, "fhir-server");

  for (const seed of patients) {
    const patient = await seedHealthkit(seed);
    await seedFhir(seed, patient);
  }

  log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
