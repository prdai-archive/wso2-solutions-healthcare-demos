import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import process from "node:process";

import { Database } from "bun:sqlite";
import { count, desc, eq, gte, max } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

import { events, requestLog } from "@/lib/schema";

// Two independent tables share this file (schema in src/lib/schema.ts); this module never runs DDL - migrations run once via scripts/migrate.ts so the several Next.js worker processes that import it concurrently can't race each other.
const dbPath = process.env.REQUEST_LOG_DB_PATH ?? "./data/request-log.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });

// Next.js build/dev spins up several worker processes that all import this module and open the same file at nearly the same instant; a 15s busy_timeout alone isn't enough right after migrate.ts just created it, so retry the open itself a few times too.
function openWithRetry(path: string, attempts = 5): Database {
  for (let i = 0; i < attempts; i++) {
    try {
      const handle = new Database(path, { create: true });
      handle.exec("PRAGMA journal_mode = WAL;");
      handle.exec("PRAGMA busy_timeout = 15000;");
      return handle;
    } catch (error) {
      if (i === attempts - 1) throw error;
      Bun.sleepSync(200 * (i + 1));
    }
  }
  throw new Error("unreachable");
}

const sqlite = openWithRetry(dbPath);
const db = drizzle(sqlite);

export interface RequestLogEntry {
  id: number;
  patientId: string;
  endpoint: string;
  triggeredAt: string;
  status: "sent" | "ok" | "error";
  responseSummary: string | null;
}

export function insertRequestLog(patientId: string, endpoint: string): number {
  const [row] = db
    .insert(requestLog)
    .values({
      patientId,
      endpoint,
      triggeredAt: new Date().toISOString(),
      status: "sent",
    })
    .returning({ id: requestLog.id })
    .all();
  return row!.id;
}

export function updateRequestLog(
  id: number,
  status: "ok" | "error",
  responseSummary: string,
): void {
  db.update(requestLog)
    .set({ status, responseSummary })
    .where(eq(requestLog.id, id))
    .run();
}

export interface CareLoopEvent {
  id: number;
  patientId: string;
  label: string;
  detail: string | null;
  payload: Record<string, string> | null;
  receivedAt: string;
}

function toCareLoopEvent(row: typeof events.$inferSelect): CareLoopEvent {
  return {
    id: row.id,
    patientId: row.patientId,
    label: row.label,
    detail: row.detail,
    payload: row.payload ? (JSON.parse(row.payload) as Record<string, string>) : null,
    receivedAt: row.receivedAt,
  };
}

export function insertEvent(
  patientId: string,
  label: string,
  detail?: string,
  payload?: Record<string, string>,
): number {
  const [row] = db
    .insert(events)
    .values({
      patientId,
      label,
      detail: detail ?? null,
      payload: payload ? JSON.stringify(payload) : null,
      receivedAt: new Date().toISOString(),
    })
    .returning({ id: events.id })
    .all();
  return row!.id;
}

export function listEvents(patientId: string, limit = 500): CareLoopEvent[] {
  const rows = db
    .select()
    .from(events)
    .where(eq(events.patientId, patientId))
    .orderBy(desc(events.receivedAt))
    .limit(limit)
    .all();
  return rows.map(toCareLoopEvent);
}

export function listRecentEvents(limit = 30): CareLoopEvent[] {
  const rows = db.select().from(events).orderBy(desc(events.receivedAt)).limit(limit).all();
  return rows.map(toCareLoopEvent);
}

export interface EventStats {
  hitsToday: number;
  lastHitAt: string | null;
}

export function getEventStats(): EventStats {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [countRow] = db
    .select({ value: count() })
    .from(events)
    .where(gte(events.receivedAt, todayStart.toISOString()))
    .all();
  const [lastRow] = db.select({ value: max(events.receivedAt) }).from(events).all();

  return { hitsToday: countRow!.value, lastHitAt: lastRow!.value ?? null };
}

export function listRequestLog(limit = 50): RequestLogEntry[] {
  const rows = db.select().from(requestLog).orderBy(desc(requestLog.id)).limit(limit).all();
  return rows.map((row) => ({
    id: row.id,
    patientId: row.patientId,
    endpoint: row.endpoint,
    triggeredAt: row.triggeredAt,
    status: row.status as RequestLogEntry["status"],
    responseSummary: row.responseSummary,
  }));
}
