import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";

import { Database } from "bun:sqlite";

// Two independent tables share this file: request_log (dashboard-initiated
// "hit and forget" requests, e.g. generate-questionnaire) and events (events
// other services POST to this dashboard about a patient). Neither is a cache
// of FHIR data.
const dbPath = process.env.REQUEST_LOG_DB_PATH ?? "./data/request-log.sqlite";

mkdirSync(dirname(dbPath), { recursive: true });
const db = new Database(dbPath, { create: true });
// Next.js build collects page data across several worker processes that each
// import this module and open the same file concurrently; without WAL mode
// and a busy timeout that causes SQLITE_BUSY ("database is locked") failures.
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA busy_timeout = 5000;");
db.exec(`
  CREATE TABLE IF NOT EXISTS request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    triggered_at TEXT NOT NULL,
    status TEXT NOT NULL,
    response_summary TEXT
  )
`);

export interface RequestLogEntry {
  id: number;
  patientId: string;
  endpoint: string;
  triggeredAt: string;
  status: "sent" | "ok" | "error";
  responseSummary: string | null;
}

export function insertRequestLog(patientId: string, endpoint: string): number {
  const result = db
    .query(
      "INSERT INTO request_log (patient_id, endpoint, triggered_at, status) VALUES (?, ?, ?, 'sent')",
    )
    .run(patientId, endpoint, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

export function updateRequestLog(
  id: number,
  status: "ok" | "error",
  responseSummary: string,
): void {
  db.query(
    "UPDATE request_log SET status = ?, response_summary = ? WHERE id = ?",
  ).run(status, responseSummary, id);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id TEXT NOT NULL,
    label TEXT NOT NULL,
    detail TEXT,
    received_at TEXT NOT NULL
  )
`);

export interface CareLoopEvent {
  id: number;
  patientId: string;
  label: string;
  detail: string | null;
  receivedAt: string;
}

export function insertEvent(
  patientId: string,
  label: string,
  detail?: string,
): number {
  const result = db
    .query(
      "INSERT INTO events (patient_id, label, detail, received_at) VALUES (?, ?, ?, ?)",
    )
    .run(patientId, label, detail ?? null, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

export function listEvents(patientId: string, limit = 200): CareLoopEvent[] {
  const rows = db
    .query(
      "SELECT id, patient_id, label, detail, received_at FROM events WHERE patient_id = ? ORDER BY received_at DESC LIMIT ?",
    )
    .all(patientId, limit) as {
    id: number;
    patient_id: string;
    label: string;
    detail: string | null;
    received_at: string;
  }[];

  return rows.map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    label: row.label,
    detail: row.detail,
    receivedAt: row.received_at,
  }));
}

export function listRequestLog(limit = 50): RequestLogEntry[] {
  const rows = db
    .query(
      "SELECT id, patient_id, endpoint, triggered_at, status, response_summary FROM request_log ORDER BY id DESC LIMIT ?",
    )
    .all(limit) as {
    id: number;
    patient_id: string;
    endpoint: string;
    triggered_at: string;
    status: string;
    response_summary: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    patientId: row.patient_id,
    endpoint: row.endpoint,
    triggeredAt: row.triggered_at,
    status: row.status as RequestLogEntry["status"],
    responseSummary: row.response_summary,
  }));
}
