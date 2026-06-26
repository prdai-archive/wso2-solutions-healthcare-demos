"use client";

import * as React from "react";

import type {
  Appointment,
  Doctor,
  Patient,
  Task,
  WaitingEntry,
} from "@/lib/types";

// The signed-in Front Desk Operator. This is the app user's identity for the
// shell, not clinical data, so it is always available.
export const receptionist = {
  name: "Maya Okonkwo",
  role: "Front Desk Operator",
  email: "maya.okonkwo@careloop.health",
  initials: "MO",
};

export interface DataSet {
  patients: Patient[];
  doctors: Doctor[];
  tasks: Task[];
  appointments: Appointment[];
  waitingRoom: WaitingEntry[];
}

// The dashboard renders empty until a real data source (OpenEMR FHIR) is wired
// in. Every dataset is an empty array; stat cards and selectors derive zero and
// empty from it.
const EMPTY: DataSet = {
  patients: [],
  doctors: [],
  tasks: [],
  appointments: [],
  waitingRoom: [],
};

interface DataApi {
  data: DataSet;
  assignTask: (taskId: string, doctorId: string) => void;
  closeTask: (taskId: string) => void;
  reopenTask: (taskId: string) => void;
  getPatient: (id: string | null | undefined) => Patient | undefined;
  getDoctor: (id: string | null | undefined) => Doctor | undefined;
  tasksForPatient: (patientId: string) => Task[];
  openTasksForPatient: (patientId: string) => Task[];
  nextReviewForPatient: (patientId: string) => Appointment | undefined;
}

const DataContext = React.createContext<DataApi | null>(null);

// There is no data to mutate yet, so the task lifecycle actions are no-ops and
// every selector resolves to empty. They stay on the API so the existing UI
// keeps compiling until the FHIR layer replaces this provider.
const EMPTY_API: DataApi = {
  data: EMPTY,
  assignTask: () => {},
  closeTask: () => {},
  reopenTask: () => {},
  getPatient: () => undefined,
  getDoctor: () => undefined,
  tasksForPatient: () => [],
  openTasksForPatient: () => [],
  nextReviewForPatient: () => undefined,
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  return (
    <DataContext.Provider value={EMPTY_API}>{children}</DataContext.Provider>
  );
}

export function useData(): DataApi {
  const ctx = React.useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used within a DataProvider");
  }
  return ctx;
}
