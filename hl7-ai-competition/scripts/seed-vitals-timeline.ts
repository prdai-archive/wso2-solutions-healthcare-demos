#!/usr/bin/env bun
// Pre-seeds the next HORIZON_HOURS of hourly vitals per patient into apple-healthkit-simulator, timestamped into the future from "now".
// Not idempotent by design: run every `make seed` so vitals-cron-service always has fresh future data to discover as real time passes.

import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const HEALTHKIT_URL = process.env.HEALTHKIT_URL ?? "http://localhost:8000";
const SEED_DATA_FILE = process.env.SEED_DATA_FILE ?? join(ROOT, "scripts/seed-data/patients.json");
const HORIZON_HOURS = Number(process.env.VITALS_HORIZON_HOURS ?? 24);

type VitalsProfile = "stable" | "borderline" | "at_risk";

type Range = { min: number; max: number };
type ProfileRanges = { heartRate: Range; systolic: Range; diastolic: Range; spo2: Range; respiratoryRate: Range };

// Baselines per AHA blood pressure categories and standard clinical vitals ranges (resting HR 60-100, SpO2 95-100%, RR 12-20 normal).
const PROFILES: Record<VitalsProfile, ProfileRanges> = {
  stable: { heartRate: { min: 60, max: 72 }, systolic: { min: 108, max: 118 }, diastolic: { min: 68, max: 78 }, spo2: { min: 97, max: 99 }, respiratoryRate: { min: 12, max: 15 } },
  borderline: { heartRate: { min: 78, max: 92 }, systolic: { min: 122, max: 134 }, diastolic: { min: 78, max: 86 }, spo2: { min: 94, max: 96 }, respiratoryRate: { min: 16, max: 19 } },
  at_risk: { heartRate: { min: 96, max: 118 }, systolic: { min: 145, max: 168 }, diastolic: { min: 92, max: 106 }, spo2: { min: 88, max: 93 }, respiratoryRate: { min: 20, max: 24 } },
};

type SeedPatient = { patient: { mrn: string; vitals_profile: string } };
type HealthkitPatient = { id: number; mrn: string };

function log(message: string): void {
  console.log(`[vitals-timeline] ${message}`);
}

function randomInRange({ min, max }: Range): number {
  return Math.round((min + Math.random() * (max - min)) * 10) / 10;
}

async function healthkitPost(path: string, body: unknown): Promise<Record<string, unknown>[]> {
  const res = await fetch(`${HEALTHKIT_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(Array.isArray(body) ? body : [body]),
  });
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Record<string, unknown>[];
}

async function fetchPatients(): Promise<HealthkitPatient[]> {
  const res = await fetch(`${HEALTHKIT_URL}/patients?limit=1000`);
  if (!res.ok) {
    throw new Error(`GET /patients failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as HealthkitPatient[];
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

async function main(): Promise<void> {
  const seedPatients = (await Bun.file(SEED_DATA_FILE).json()) as SeedPatient[];
  const profileByMrn = new Map(seedPatients.map((p) => [p.patient.mrn, p.patient.vitals_profile as VitalsProfile]));

  const healthkitPatients = await fetchPatients();

  const now = new Date();
  const firstHour = new Date(now);
  firstHour.setMinutes(0, 0, 0);
  firstHour.setHours(firstHour.getHours() + 1);

  for (const patient of healthkitPatients) {
    const profileName = profileByMrn.get(patient.mrn);
    if (!profileName) {
      continue;
    }
    const profile = PROFILES[profileName];
    for (let hour = 0; hour < HORIZON_HOURS; hour++) {
      const hourStart = new Date(firstHour.getTime() + hour * 60 * 60 * 1000);
      await seedHourlyVitals(patient, profile, hourStart);
    }
    log(`seeded ${HORIZON_HOURS}h of future vitals for ${patient.mrn} (${profileName}), starting ${firstHour.toISOString()}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
