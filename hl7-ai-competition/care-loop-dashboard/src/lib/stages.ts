// The real, distinct event labels our backend services actually fire, in
// pipeline order. A run rarely hits every stage (e.g. no escalation below
// threshold) - that's expected, not a bug. Keep this list in sync with the
// notifyDashboard/reportDashboardEvent call sites in each service.
export interface StageDef {
  key: string;
  label: string;
  service: string;
  method: string;
  endpoint: string;
}

export const STAGE_DEFS: StageDef[] = [
  {
    key: "vitals",
    label: "Vitals ingested",
    service: "care-loop-collector-service",
    method: "POST",
    endpoint: "/vitals",
  },
  {
    key: "ml",
    label: "ML risk scoring complete",
    service: "care-loop-analysis-service",
    method: "POST",
    endpoint: "/predict (via care-loop-heart-risk-service)",
  },
  {
    key: "escalation",
    label: "Escalation triggered",
    service: "care-loop-analysis-service",
    method: "—",
    endpoint: "internal decision",
  },
  {
    key: "quest",
    label: "Questionnaire drafted",
    service: "care-loop-ai-service",
    method: "POST",
    endpoint: "/questionnaires",
  },
  {
    key: "sent",
    label: "Sent via WhatsApp",
    service: "whatsapp-simulator",
    method: "POST",
    endpoint: "/api/sessions",
  },
  {
    key: "respond",
    label: "Patient responded via WhatsApp",
    service: "whatsapp-simulator",
    method: "POST",
    endpoint: "/api/sessions/{id}/submit",
  },
  {
    key: "agentic_draft",
    label: "Agentic risk assessment drafted",
    service: "care-loop-ai-service",
    method: "POST",
    endpoint: "/risk-assessment",
  },
  {
    key: "agentic",
    label: "Agentic risk assessment complete",
    service: "care-loop-analysis-service",
    method: "POST",
    endpoint: "/fhir/RiskAssessment",
  },
  {
    key: "task_desc",
    label: "Task description drafted",
    service: "care-loop-ai-service",
    method: "POST",
    endpoint: "/task-description",
  },
  {
    key: "fhir",
    label: "FHIR Task created for front-desk",
    service: "care-loop-analysis-service",
    method: "POST",
    endpoint: "/fhir/Task",
  },
  {
    key: "clinician",
    label: "Clinician review",
    service: "front-desk-dashboard",
    method: "—",
    endpoint: "not observable from this dashboard",
  },
];

// A new run starts at each "Vitals ingested" event - that's the real trigger
// collector-service fires at the top of every pipeline pass.
export const RUN_BOUNDARY_LABEL = "Vitals ingested";
export const NOT_OBSERVABLE_KEY = "clinician";
