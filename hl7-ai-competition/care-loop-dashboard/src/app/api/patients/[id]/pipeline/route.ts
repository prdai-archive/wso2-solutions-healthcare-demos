import type {
  Bundle,
  Observation as FhirObservation,
  RiskAssessment as FhirRiskAssessment,
  Task as FhirTask,
} from "fhir/r4";

import process from "node:process";

import { Client } from "fhir-kit-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Every stage here is derived from real, already-existing state on the
// backends — this route never invents a signal. See README notes below each
// stage for exactly what is being observed and which service writes it.
export type StageStatus = "pending" | "active" | "done";

export interface PipelineStage {
  key: string;
  order: number;
  label: string;
  service: string;
  status: StageStatus;
  timestamp: string | undefined;
  detail: string | undefined;
  inferred: boolean;
  observable: boolean;
}

interface WhatsAppSession {
  id: string;
  patientId: string;
  status: "pending" | "completed";
  createdAt: string;
  title: string;
}

async function fetchLatestVital(
  fhirBaseUrl: string,
  patientId: string,
): Promise<FhirObservation | undefined> {
  const client = new Client({ baseUrl: fhirBaseUrl });
  const bundle = (await client.resourceSearch({
    resourceType: "Observation",
    searchParams: { subject: `Patient/${patientId}`, _sort: "-date", _count: 1 },
  })) as unknown as Bundle<FhirObservation>;
  return bundle.entry?.[0]?.resource;
}

async function fetchRiskAssessments(
  fhirBaseUrl: string,
  patientId: string,
): Promise<FhirRiskAssessment[]> {
  const client = new Client({ baseUrl: fhirBaseUrl });
  const bundle = (await client.resourceSearch({
    resourceType: "RiskAssessment",
    searchParams: {
      subject: `Patient/${patientId}`,
      _sort: "-_lastUpdated",
      _count: 20,
    },
  })) as unknown as Bundle<FhirRiskAssessment>;
  return (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter((r): r is FhirRiskAssessment => r !== undefined);
}

async function fetchWhatsAppSessions(
  whatsappBaseUrl: string,
  patientId: string,
): Promise<WhatsAppSession[]> {
  const response = await fetch(`${whatsappBaseUrl}/api/sessions`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`whatsapp-simulator returned ${response.status}`);
  const data = (await response.json()) as { sessions: WhatsAppSession[] };
  // No server-side filter param exists on /api/sessions — filter client-side.
  return data.sessions.filter((s) => s.patientId === patientId);
}

async function fetchLatestTask(
  ehrFhirBaseUrl: string,
  patientId: string,
): Promise<FhirTask | undefined> {
  const client = new Client({ baseUrl: ehrFhirBaseUrl });
  const bundle = (await client.resourceSearch({
    resourceType: "Task",
    searchParams: { patient: `Patient/${patientId}`, _count: 20 },
  })) as unknown as Bundle<FhirTask>;
  const tasks = (bundle.entry ?? [])
    .map((entry) => entry.resource)
    .filter((r): r is FhirTask => r !== undefined);
  tasks.sort((a, b) =>
    (b.meta?.lastUpdated ?? "").localeCompare(a.meta?.lastUpdated ?? ""),
  );
  return tasks[0];
}

function truncate(text: string | undefined, length: number): string | undefined {
  if (!text) return undefined;
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const careLoopFhirUrl =
    process.env.CARE_LOOP_FHIR_SERVER_URL ?? "http://localhost:9091/fhir";
  const ehrFhirUrl =
    process.env.EHR_FHIR_SERVER_URL ?? "http://localhost:9090/fhir/r4";
  const whatsappUrl =
    process.env.WHATSAPP_SIMULATOR_URL ?? "http://localhost:3000";

  const [vitalResult, riskResult, sessionResult, taskResult] =
    await Promise.allSettled([
      fetchLatestVital(careLoopFhirUrl, id),
      fetchRiskAssessments(careLoopFhirUrl, id),
      fetchWhatsAppSessions(whatsappUrl, id),
      fetchLatestTask(ehrFhirUrl, id),
    ]);

  const latestVital = vitalResult.status === "fulfilled" ? vitalResult.value : undefined;
  const riskAssessments = riskResult.status === "fulfilled" ? riskResult.value : [];
  const sessions = sessionResult.status === "fulfilled" ? sessionResult.value : [];
  const latestTask = taskResult.status === "fulfilled" ? taskResult.value : undefined;

  if (riskResult.status === "rejected") {
    console.error(`pipeline: RiskAssessment fetch failed for ${id}`, riskResult.reason);
  }
  if (sessionResult.status === "rejected") {
    console.error(`pipeline: whatsapp-simulator fetch failed for ${id}`, sessionResult.reason);
  }
  if (taskResult.status === "rejected") {
    console.error(`pipeline: Task fetch failed for ${id}`, taskResult.reason);
  }

  const mlAssessment = riskAssessments.find((r) => r.method?.text?.includes("heart-risk-service"));
  const agenticAssessment = riskAssessments.find(
    (r) => r.method?.text?.includes("ai-service") && !r.method.text.includes("heart-risk-service"),
  );

  const session = sessions
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const respondedSession = sessions.find((s) => s.status === "completed");

  const vitalValue =
    latestVital && "valueQuantity" in latestVital ? latestVital.valueQuantity : undefined;
  const vitalTimestamp =
    latestVital && "effectiveDateTime" in latestVital ? latestVital.effectiveDateTime : undefined;

  const mlPrediction = mlAssessment?.prediction?.[0];
  const agenticPrediction = agenticAssessment?.prediction?.[0];

  const stageDefs: Omit<PipelineStage, "status">[] = [
    {
      key: "vitals-ingested",
      order: 1,
      label: "Vitals ingested",
      service: "Apple HealthKit -> care-loop-collector-service",
      timestamp: vitalTimestamp,
      detail: latestVital
        ? `${latestVital.code?.coding?.[0]?.display ?? latestVital.code?.text ?? "vital"}: ${vitalValue?.value ?? "—"} ${vitalValue?.unit ?? ""}`
        : undefined,
      inferred: false,
      observable: true,
    },
    {
      key: "ml-risk-scoring",
      order: 2,
      label: "ML risk scoring",
      service: "care-loop-heart-risk-service via care-loop-analysis-service",
      timestamp: mlAssessment?.occurrenceDateTime,
      detail: mlPrediction?.probabilityDecimal !== undefined
        ? `probability ${(mlPrediction.probabilityDecimal * 100).toFixed(0)}%`
        : undefined,
      inferred: false,
      observable: true,
    },
    {
      key: "questionnaire-drafted",
      order: 3,
      label: "Questionnaire drafted",
      service: "care-loop-ai-service (POST /questionnaires)",
      timestamp: session?.createdAt,
      detail: session ? truncate(session.title, 60) : undefined,
      // care-loop-ai-service returns the draft directly and never persists a
      // FHIR Questionnaire — the earliest observable trace of a draft
      // existing is the WhatsApp session it produces, so this stage's timing
      // is inferred from stage 4 rather than measured independently.
      inferred: true,
      observable: true,
    },
    {
      key: "sent-via-whatsapp",
      order: 4,
      label: "Sent via WhatsApp",
      service: "whatsapp-simulator",
      timestamp: session?.createdAt,
      detail: session ? truncate(session.title, 60) : undefined,
      inferred: false,
      observable: true,
    },
    {
      key: "patient-responds",
      order: 5,
      label: "Patient responds",
      service: "whatsapp-simulator",
      timestamp: respondedSession ? respondedSession.createdAt : undefined,
      detail: respondedSession ? truncate(respondedSession.title, 60) : undefined,
      inferred: false,
      observable: true,
    },
    {
      key: "agentic-risk-assessment",
      order: 6,
      label: "Agentic risk assessment",
      service: "care-loop-ai-service / care-loop-analysis-service",
      timestamp: agenticAssessment?.occurrenceDateTime,
      detail: agenticPrediction?.qualitativeRisk?.text
        ?? (agenticPrediction?.probabilityDecimal !== undefined
          ? `risk ${(agenticPrediction.probabilityDecimal * 100).toFixed(0)}%`
          : undefined),
      inferred: false,
      observable: true,
    },
    {
      key: "task-created",
      order: 7,
      label: "FHIR Task created",
      service: "care-loop-analysis-service -> ehr-fhir-server",
      timestamp: latestTask?.meta?.lastUpdated,
      detail: latestTask
        ? `Task/${latestTask.id} · ${latestTask.priority ?? "routine"}`
        : undefined,
      inferred: false,
      observable: true,
    },
    {
      key: "clinician-review",
      order: 8,
      label: "Clinician review",
      service: "front-desk-dashboard",
      timestamp: undefined,
      detail: latestTask
        ? "Handed off to front-desk-dashboard triage queue"
        : undefined,
      inferred: false,
      observable: false,
    },
  ];

  const doneFlags = stageDefs.map((s) => s.observable && s.timestamp !== undefined);
  const firstNotDoneIndex = doneFlags.findIndex((done) => !done);

  const stages: PipelineStage[] = stageDefs.map((stage, index) => {
    let status: StageStatus = "pending";
    if (doneFlags[index]) status = "done";
    else if (index === firstNotDoneIndex && stage.observable) status = "active";
    return { ...stage, status };
  });

  return NextResponse.json({ stages });
}
