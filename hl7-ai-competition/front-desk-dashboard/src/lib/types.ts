type Sex = "Male" | "Female";

export type RiskLevel = "High" | "Moderate" | "Low";

// Monitoring status for an enrolled heart-failure patient.
export type PatientStatus =
  // has an active remote-monitoring alert
  | "Flagged"
  // enrolled, trending watch
  | "Monitoring"
  // enrolled, within range
  | "Stable"
  | "Inactive";

export interface Patient {
  id: string;
  name: string;
  mrn: string;
  // ISO date
  dob: string;
  age: number;
  sex: Sex;
  phone: string;
  email: string;
  insurance: string;
  memberId: string;
  // e.g. "HFrEF, EF 32%"
  diagnosis: string;
  status: PatientStatus;
  riskLevel: RiskLevel;
  // 0-100, latest risk-assessment score
  riskScore: number;
  // ISO datetime of latest device/questionnaire reading
  lastReading: string;
  pronouns?: string;
  address: string;
}

// The signal that tripped the remote-monitoring model.
export type AlertType =
  | "Weight gain"
  | "Rising biomarkers"
  | "Worsening dyspnea"
  | "Low SpO2"
  | "Arrhythmia"
  | "Blood pressure";

// FHIR Task.priority — urgent vs routine.
export type TaskPriority = "Urgent" | "Routine";

// Assignment lifecycle for a triage task.
export type TaskStatus = "Unassigned" | "Assigned" | "Closed";

interface Vitals {
  weightKg: number;
  // 3-day delta
  weightChangeKg: number;
  heartRate: number;
  // "128/82"
  bloodPressure: string;
  // percent oxygen saturation
  spo2: number;
}

// A heart-failure remote-monitoring alert triage task, modeled on a FHIR Task
// (status "ready", intent "order"). The Front Desk Operator routes it to a
// clinician.
export interface Task {
  id: string;
  // FHIR Task.code text, e.g. "Review remote monitoring alert"
  code: string;
  alertType: AlertType;
  title: string;
  description: string;
  patientId: string;
  priority: TaskPriority;
  status: TaskStatus;
  // doctor id, when assigned
  assignedTo: string | null;
  // referenced risk-assessment score
  riskScore: number;
  // referenced latest vitals
  vitals: Vitals;
  // referenced symptom-questionnaire response
  symptom: string;
  // human-friendly time the alert was raised
  raisedAt: string;
  // sort key (earlier = higher in queue)
  order: number;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  initials: string;
}

export type AppointmentStatus =
  | "Scheduled"
  | "Confirmed"
  | "In review"
  | "Completed"
  | "Missed";

type Modality = "Telehealth" | "In-person";

export interface Appointment {
  id: string;
  patientId: string;
  // e.g. "09:15"
  time: string;
  doctor: string;
  reason: string;
  modality: Modality;
  status: AppointmentStatus;
}

// An alert that has been flagged and is awaiting triage by the operator.
export interface WaitingEntry {
  patientId: string;
  // e.g. "08:52"
  flaggedAt: string;
  // minutes the alert has waited unassigned
  waitMinutes: number;
  taskId: string;
}
