import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Events other Care Loop services POST to this dashboard; payload is an optional JSON-encoded flat object of real fields the firing service already had in scope.
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  patientId: text("patient_id").notNull(),
  label: text("label").notNull(),
  detail: text("detail"),
  payload: text("payload"),
  receivedAt: text("received_at").notNull(),
});
