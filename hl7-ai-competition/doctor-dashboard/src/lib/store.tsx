"use client";

import { createContext, useContext, useMemo } from "react";
import type { Appointment, Patient, ReviewItem, ReviewKind } from "@/lib/types";

// Static clinician identity for the shell (header, sidebar). This is app
// identity, not clinical data, so it is not part of the empty dataset below.
export const doctor = {
  name: "Dr. Amara Silva",
  specialty: "Heart Failure / Cardiology",
  role: "Attending Physician",
  initials: "AS",
};

interface Dataset {
  patients: Patient[];
  appointments: Appointment[];
  reviews: ReviewItem[];
}

// The dashboard renders empty until a real data source (OpenEMR FHIR) is wired
// in. There is no seeding or client-side persistence.
const EMPTY_DATASET: Dataset = {
  patients: [],
  appointments: [],
  reviews: [],
};

export interface DashboardStats {
  escalatedCases: number;
  abnormalLabs: number;
  unsignedNotes: number;
  patientMessages: number;
}

interface DataContextValue extends Dataset {
  doctor: typeof doctor;
  getPatient: (id: string) => Patient | undefined;
  reviewsByKind: (kind: ReviewKind) => ReviewItem[];
  stats: DashboardStats;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<DataContextValue>(() => {
    const data = EMPTY_DATASET;
    const getPatient = (id: string) => data.patients.find((p) => p.id === id);
    const reviewsByKind = (kind: ReviewKind) =>
      data.reviews.filter((r) => r.kind === kind);
    const stats: DashboardStats = {
      escalatedCases: data.patients.length,
      abnormalLabs: data.reviews.filter((r) => r.kind === "lab").length,
      unsignedNotes: data.reviews.filter((r) => r.kind === "note").length,
      patientMessages: data.reviews.filter((r) => r.kind === "message").length,
    };
    return {
      ...data,
      doctor,
      getPatient,
      reviewsByKind,
      stats,
    };
  }, []);

  return <DataContext value={value}>{children}</DataContext>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within a DataProvider");
  }
  return ctx;
}
