export type Sex = "M" | "F";

export type AppointmentStatus =
  | "Scheduled"
  | "Checked-in"
  | "In room"
  | "Completed";

export type VisitType =
  | "Follow-up"
  | "New patient"
  | "Annual physical"
  | "Telehealth"
  | "Procedure"
  | "Urgent";

export type Severity = "Routine" | "Abnormal" | "Urgent" | "Critical";

export type ReviewKind =
  | "lab"
  | "questionnaire"
  | "refill"
  | "message"
  | "note";

export type RiskLevel = "High" | "Moderate" | "Low";

export interface Escalation {
  flagReason: string;
  riskLevel: RiskLevel;
  riskScore: number;
  escalatedAt: string;
  escalatedBy: string;
}

export interface VitalsPoint {
  date: string;
  weightKg: number;
  bp: string;
  hr: number;
}

export interface SymptomResponse {
  id: string;
  question: string;
  answer: string;
  flagged: boolean;
}

export interface Vitals {
  bp: string;
  hr: number;
  temp: number;
  spo2: number;
  weightKg: number;
  bmi: number;
  recordedAt: string;
}

export interface Medication {
  name: string;
  dose: string;
  frequency: string;
  startedOn: string;
  status: "Active" | "Paused";
}

export interface Condition {
  name: string;
  status: "Active" | "Controlled" | "Resolved";
  since: string;
}

export interface LabResult {
  id: string;
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: "Normal" | "High" | "Low" | "Critical";
  collectedOn: string;
}

export interface CareTask {
  id: string;
  label: string;
  due: string;
  done: boolean;
}

export interface Patient {
  id: string;
  name: string;
  mrn: string;
  age: number;
  sex: Sex;
  avatarColor: string;
  allergies: string[];
  primaryCondition: string;
  conditions: Condition[];
  medications: Medication[];
  vitals: Vitals;
  vitalsTrend: VitalsPoint[];
  labs: LabResult[];
  tasks: CareTask[];
  symptomResponses: SymptomResponse[];
  escalation: Escalation;
  lastSeen: string;
  nextAppointment: string | null;
}

export interface Appointment {
  id: string;
  time: string;
  patientId: string;
  visitType: VisitType;
  reason: string;
  status: AppointmentStatus;
  durationMin: number;
}

export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  patientId: string;
  title: string;
  summary: string;
  severity: Severity;
  receivedAt: string;
}
