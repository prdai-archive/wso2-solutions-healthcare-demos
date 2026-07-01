#!/usr/bin/env bun

import { join } from "node:path";

const HEALTHKIT_URL = process.env.HEALTHKIT_URL ?? "http://localhost:8000";
const FHIR_SERVER_URL = process.env.FHIR_SERVER_URL ?? "http://localhost:9090/fhir/r4";
const SEED_DATA_FILE = process.env.SEED_DATA_FILE ?? join(import.meta.dir, "data/patients.json");
const VITALS_HORIZON_HOURS = Number(process.env.VITALS_HORIZON_HOURS ?? 24);

type VitalsProfile = "stable" | "borderline" | "at_risk";
type Range = { min: number; max: number };
type ProfileRanges = { heartRate: Range; systolic: Range; diastolic: Range; spo2: Range; respiratoryRate: Range };

const PROFILES: Record<VitalsProfile, ProfileRanges> = {
  stable: { heartRate: { min: 60, max: 72 }, systolic: { min: 108, max: 118 }, diastolic: { min: 68, max: 78 }, spo2: { min: 97, max: 99 }, respiratoryRate: { min: 12, max: 15 } },
  borderline: { heartRate: { min: 78, max: 92 }, systolic: { min: 122, max: 134 }, diastolic: { min: 78, max: 86 }, spo2: { min: 94, max: 96 }, respiratoryRate: { min: 16, max: 19 } },
  at_risk: { heartRate: { min: 96, max: 118 }, systolic: { min: 145, max: 168 }, diastolic: { min: 92, max: 106 }, spo2: { min: 88, max: 93 }, respiratoryRate: { min: 20, max: 24 } },
};

type QuantitySample = Record<string, unknown>;
type SeedPatient = {
  patient: { mrn: string; given_name: string; family_name: string; date_of_birth: string; vitals_profile: VitalsProfile };
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
    allergies: Record<string, unknown>[];
    medications: Record<string, unknown>[];
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

  for (const allergy of seed.fhir.allergies) {
    const created = await fhirCreate<{ id: string }>("AllergyIntolerance", { ...allergy, patient: subject });
    log(`created fhir-server AllergyIntolerance/${created.id}`);
  }

  for (const medication of seed.fhir.medications) {
    const created = await fhirCreate<{ id: string }>("MedicationRequest", { ...medication, subject });
    log(`created fhir-server MedicationRequest/${created.id}`);
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

function randomInRange({ min, max }: Range): number {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

async function seedHourlyVitals(patient: HealthkitPatient, profile: ProfileRanges, hourStart: Date): Promise<void> {
  const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
  const isoStart = hourStart.toISOString();

  await healthkitPost("/quantity-samples", [
    {
      patient_id: patient.id,
      source_name: "Apple Watch",
      quantity_type: "HKQuantityTypeIdentifierHeartRate",
      value: randomInRange(profile.heartRate),
      unit: "count/min",
      start_date: isoStart,
      end_date: hourEnd.toISOString(),
    },
    {
      patient_id: patient.id,
      source_name: "Apple Watch",
      quantity_type: "HKQuantityTypeIdentifierOxygenSaturation",
      value: randomInRange(profile.spo2),
      unit: "%",
      start_date: isoStart,
      end_date: hourEnd.toISOString(),
    },
    {
      patient_id: patient.id,
      source_name: "Apple Watch",
      quantity_type: "HKQuantityTypeIdentifierRespiratoryRate",
      value: randomInRange(profile.respiratoryRate),
      unit: "count/min",
      start_date: isoStart,
      end_date: hourEnd.toISOString(),
    },
  ]);

  const [correlation] = await healthkitPost("/correlations", {
    patient_id: patient.id,
    source_name: "Withings BPM Connect",
    correlation_type: "HKCorrelationTypeIdentifierBloodPressure",
    start_date: isoStart,
    end_date: isoStart,
  });
  await healthkitPost("/quantity-samples", [
    {
      patient_id: patient.id,
      correlation_id: correlation.id,
      source_name: "Withings BPM Connect",
      quantity_type: "HKQuantityTypeIdentifierBloodPressureSystolic",
      value: randomInRange(profile.systolic),
      unit: "mmHg",
      start_date: isoStart,
      end_date: isoStart,
    },
    {
      patient_id: patient.id,
      correlation_id: correlation.id,
      source_name: "Withings BPM Connect",
      quantity_type: "HKQuantityTypeIdentifierBloodPressureDiastolic",
      value: randomInRange(profile.diastolic),
      unit: "mmHg",
      start_date: isoStart,
      end_date: isoStart,
    },
  ]);
}

async function seedVitalsTimeline(patients: SeedPatient[], healthkitPatients: HealthkitPatient[]): Promise<void> {
  const profileByMrn = new Map(patients.map((p) => [p.patient.mrn, p.patient.vitals_profile]));

  const firstHour = new Date();
  firstHour.setMinutes(0, 0, 0);
  firstHour.setHours(firstHour.getHours() + 1);

  for (const patient of healthkitPatients) {
    const profileName = profileByMrn.get(patient.mrn);
    if (!profileName) {
      continue;
    }
    const profile = PROFILES[profileName];
    for (let hour = 0; hour < VITALS_HORIZON_HOURS; hour++) {
      await seedHourlyVitals(patient, profile, new Date(firstHour.getTime() + hour * 60 * 60 * 1000));
    }
    log(`seeded ${VITALS_HORIZON_HOURS}h of future vitals for ${patient.mrn} (${profileName})`);
  }
}

async function main(): Promise<void> {
  const patients = (await Bun.file(SEED_DATA_FILE).json()) as SeedPatient[];

  await waitForHealthy(`${HEALTHKIT_URL}/health`, "apple-healthkit-simulator");
  await waitForHealthy(`${FHIR_SERVER_URL}/metadata`, "fhir-server");

  const healthkitPatients: HealthkitPatient[] = [];
  for (const seed of patients) {
    const patient = await seedHealthkit(seed);
    await seedFhir(seed, patient);
    healthkitPatients.push(patient);
  }

  await seedVitalsTimeline(patients, healthkitPatients);

  log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
