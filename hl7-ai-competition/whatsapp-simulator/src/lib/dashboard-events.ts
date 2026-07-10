import ky from "ky";

import { logger } from "@/lib/logger";

const DASHBOARD_EVENTS_URL =
  process.env.DASHBOARD_EVENTS_URL ?? "http://localhost:3003";

interface DashboardEvent {
  patientId: string;
  label: string;
  detail?: string;
}

// Fire-and-forget: the dashboard feed is best-effort and must never block or
// fail a real request in this app.
export function notifyDashboard(event: DashboardEvent): void {
  ky.post(`${DASHBOARD_EVENTS_URL}/api/events`, {
    json: event,
    timeout: 3_000,
    retry: 0,
  }).catch((error) => {
    logger.warn("dashboard event delivery failed", { event, error });
  });
}
