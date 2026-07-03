export type FhirResource = { resourceType: string; id: string; meta?: { lastUpdated?: string }; identifier?: unknown[] } & Record<string, unknown>;
export type FhirBundle = { resourceType: "Bundle"; entry?: Array<{ resource: FhirResource }>; link?: Array<{ relation: string; url: string }> };

// resourceType -> field name -> the resourceType the reference field points to.
export const REFERENCE_FIELDS: Record<string, Record<string, string>> = {
  Encounter: { subject: "Patient" },
  Condition: { subject: "Patient" },
  AllergyIntolerance: { patient: "Patient" },
  MedicationRequest: { subject: "Patient" },
  Observation: { subject: "Patient", encounter: "Encounter" },
};

// Dependency order: referenced resource types must sync before their referrers.
export const SYNC_ORDER = ["Patient", "Encounter", "Condition", "AllergyIntolerance", "MedicationRequest", "Observation"];
