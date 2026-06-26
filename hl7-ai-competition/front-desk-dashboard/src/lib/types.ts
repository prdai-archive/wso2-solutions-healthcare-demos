export type Sex = "Male" | "Female";

export type RiskLevel = "High" | "Moderate" | "Low";

// Monitoring status for an enrolled heart-failure patient.
export type PatientStatus =
  | "Flagged" // has an active remote-monitoring alert
  | "Monitoring" // enrolled, trending watch
  | "Stable" // enrolled, within range
  | "Inactive";

export interface Patient {
  id: string;
  name: string;
  mrn: string;
  dob: string; // ISO date
  age: number;
  sex: Sex;
  phone: string;
  email: string;
  insurance: string;
  memberId: string;
  diagnosis: string; // e.g. "HFrEF, EF 32%"
  status: PatientStatus;
  riskLevel: RiskLevel;
  riskScore: number; // 0-100, latest risk-assessment score
  lastReading: string; // ISO datetime of latest device/questionnaire reading
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

export interface Vitals {
  weightKg: number;
  weightChangeKg: number; // 3-day delta
  heartRate: number;
  bloodPressure: string; // "128/82"
  spo2: number; // %
}

// A heart-failure remote-monitoring alert triage task, modeled on a FHIR Task
// (status "ready", intent "order"). The Front Desk Operator routes it to a
// clinician.
export interface Task {
  id: string;
  code: string; // FHIR Task.code text, e.g. "Review remote monitoring alert"
  alertType: AlertType;
  title: string;
  description: string;
  patientId: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo: string | null; // doctor id, when assigned
  riskScore: number; // referenced risk-assessment score
  vitals: Vitals; // referenced latest vitals
  symptom: string; // referenced symptom-questionnaire response
  raisedAt: string; // human-friendly time the alert was raised
  order: number; // sort key (earlier = higher in queue)
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

export type Modality = "Telehealth" | "In-person";

export interface Appointment {
  id: string;
  patientId: string;
  time: string; // e.g. "09:15"
  doctor: string;
  reason: string;
  modality: Modality;
  status: AppointmentStatus;
}

// An alert that has been flagged and is awaiting triage by the operator.
export interface WaitingEntry {
  patientId: string;
  flaggedAt: string; // e.g. "08:52"
  waitMinutes: number; // minutes the alert has waited unassigned
  taskId: string;
}
