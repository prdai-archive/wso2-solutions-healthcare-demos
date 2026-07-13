import type { Bundle, Patient as FhirPatient, Observation, RiskAssessment, Task } from "fhir/r4";

import process from "node:process";

import { Client } from "fhir-kit-client";
import { NextResponse } from "next/server";

import { listEvents, listRecentEvents } from "@/lib/db";

export const runtime = "nodejs";

const CLOSED_STATUSES = new Set(["completed", "cancelled", "entered-in-error"]);
const ML_METHOD_MARKER = "heart-risk-service";
const HEART_RATE_MARKER = "heart rate";

export interface HomePatientRow {
  id: string;
  name: string;
  latestHr: number | null;
  mlRisk: number | null;
  openTasks: number;
  lastActivity: string | null;
}

export interface HomeSummary {
  totalPatients: number;
  openTasks: number;
  escalationsToday: number;
  avgMlRisk: number | null;
  latestEvent: string | null;
  patients: HomePatientRow[];
}

function formatName(patient: FhirPatient): string {
  const name = patient.name?.[0];
  if (!name) return "Unknown patient";
  return [...(name.given ?? []), name.family].filter(Boolean).join(" ");
}

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  return date.toDateString() === new Date().toDateString();
}

const EMPTY_SUMMARY: HomeSummary = {
  totalPatients: 0,
  openTasks: 0,
  escalationsToday: 0,
  avgMlRisk: null,
  latestEvent: null,
  patients: [],
};

export async function GET() {
  const careLoopBaseUrl = process.env.CARE_LOOP_FHIR_SERVER_URL ?? "http://localhost:9091/fhir";
  const ehrBaseUrl = process.env.EHR_FHIR_SERVER_URL ?? "http://localhost:9090/fhir/r4";

  try {
    const careLoopClient = new Client({ baseUrl: careLoopBaseUrl });
    const ehrClient = new Client({ baseUrl: ehrBaseUrl });

    const patientBundle = (await careLoopClient.resourceSearch({
      resourceType: "Patient",
      searchParams: { _count: 200 },
    })) as unknown as Bundle<FhirPatient>;

    const patients = (patientBundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter((resource): resource is FhirPatient => resource !== undefined);

    const rows = await Promise.all(
      patients.map(async (patient) => {
        const id = patient.id ?? "";

        const [taskBundle, riskBundle, obsBundle] = await Promise.all([
          ehrClient.resourceSearch({
            resourceType: "Task",
            searchParams: { patient: `Patient/${id}`, _sort: "-_lastUpdated", _count: 50 },
          }) as unknown as Promise<Bundle<Task>>,
          careLoopClient.resourceSearch({
            resourceType: "RiskAssessment",
            searchParams: { subject: `Patient/${id}`, _sort: "-_lastUpdated", _count: 50 },
          }) as unknown as Promise<Bundle<RiskAssessment>>,
          careLoopClient.resourceSearch({
            resourceType: "Observation",
            searchParams: { subject: `Patient/${id}`, _sort: "-date", _count: 50 },
          }) as unknown as Promise<Bundle<Observation>>,
        ]);

        const tasks = (taskBundle.entry ?? [])
          .map((entry) => entry.resource)
          .filter((resource): resource is Task => resource !== undefined);
        const openTasks = tasks.filter((task) => !CLOSED_STATUSES.has(task.status.toLowerCase())).length;
        const escalationsToday = tasks.filter((task) => isToday(task.authoredOn ?? task.meta?.lastUpdated)).length;

        const riskAssessments = (riskBundle.entry ?? [])
          .map((entry) => entry.resource)
          .filter((resource): resource is RiskAssessment => resource !== undefined);
        const mlAssessment = riskAssessments.find((assessment) =>
          assessment.method?.text?.toLowerCase().includes(ML_METHOD_MARKER),
        );
        const mlRisk = mlAssessment?.prediction?.[0]?.probabilityDecimal ?? null;

        const observations = (obsBundle.entry ?? [])
          .map((entry) => entry.resource)
          .filter((resource): resource is Observation => resource !== undefined);
        const hrObservation = observations.find((observation) =>
          (observation.code.coding?.[0]?.display ?? observation.code.text ?? "")
            .toLowerCase()
            .includes(HEART_RATE_MARKER),
        );
        const latestHr = hrObservation?.valueQuantity?.value ?? null;

        const lastActivity = listEvents(id, 1)[0]?.receivedAt ?? null;

        return {
          id,
          name: formatName(patient),
          latestHr,
          mlRisk,
          openTasks,
          escalationsToday,
          lastActivity,
        };
      }),
    );

    const totalPatients = rows.length;
    const openTasksTotal = rows.reduce((sum, row) => sum + row.openTasks, 0);
    const escalationsToday = rows.reduce((sum, row) => sum + row.escalationsToday, 0);
    const mlRisks = rows.map((row) => row.mlRisk).filter((value): value is number => value !== null);
    const avgMlRisk = mlRisks.length > 0 ? mlRisks.reduce((sum, value) => sum + value, 0) / mlRisks.length : null;
    const latestEvent = listRecentEvents(1)[0]?.receivedAt ?? null;

    const summary: HomeSummary = {
      totalPatients,
      openTasks: openTasksTotal,
      escalationsToday,
      avgMlRisk,
      latestEvent,
      patients: rows.map(({ escalationsToday: _escalationsToday, ...row }) => row),
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("failed to compute home summary", error);
    return NextResponse.json(EMPTY_SUMMARY);
  }
}
