import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Dashboard-initiated "hit and forget" requests, e.g. the manual generate
// questionnaire trigger. Never a cache of FHIR data.
export const requestLog = sqliteTable("request_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: text("patient_id").notNull(),
  endpoint: text("endpoint").notNull(),
  triggeredAt: text("triggered_at").notNull(),
  status: text("status").notNull(),
  responseSummary: text("response_summary"),
});

// Events other Care Loop services POST to this dashboard about a patient.
// payload is an optional JSON-encoded flat object of string -> string with
// whatever real fields the firing service already had in scope.
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: text("patient_id").notNull(),
  label: text("label").notNull(),
  detail: text("detail"),
  payload: text("payload"),
  receivedAt: text("received_at").notNull(),
});
