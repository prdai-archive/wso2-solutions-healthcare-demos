# care-loop-dashboard

Internal ops dashboard for the Care Loop. Not a clinician-facing tool like
front-desk-dashboard - this is a live, per-patient pipeline view of what the
other Care Loop services are doing (vitals in, ML scoring, questionnaire
delivery, agentic assessment, FHIR Task handoff), plus a way to manually fire
a questionnaire draft during a demo.

The main view is a pannable canvas of stage nodes connected in pipeline
order, a per-patient run picker (a run is one pass through the pipeline,
starting at "Vitals ingested"), a detail panel for whichever stage is
selected, and a live ticker of the most recent events across all patients.

Built with Next.js 16 (App Router, TypeScript), Tailwind CSS v4, and the same
shadcn/ui component set as front-desk-dashboard, run with bun.

## What it shows

This dashboard does not poll or infer state from FHIR or whatsapp-simulator.
Instead, other backend services POST a simple event to this dashboard
whenever something happens for a patient, and the dashboard segments those
events into runs and renders them as a pipeline (`src/lib/runs.ts`,
`src/lib/stages.ts` list the real stage order - keep it in sync with the
notifyDashboard/reportDashboardEvent call sites in each service).

Selecting a patient defaults to their latest run; the run picker lets you
look at earlier ones. Everything polls every 4s. If a patient has no events
yet, the canvas says so plainly.

- **Generate questionnaire** - fires `POST /questionnaires` directly at
  care-loop-ai-service with `{patientId}`. This is fire-and-forget: the
  button sends the request, logs it, and returns immediately rather than
  blocking on the agent's response.

## Event ingestion contract

Other services report progress by POSTing to this dashboard directly:

```
POST /api/events
Content-Type: application/json

{
  "patientId": "string",
  "label": "string",
  "detail": "string (optional)",
  "payload": { "key": "value", "...": "..." } (optional, flat, strings only)
}
```

No auth (internal network only). The dashboard inserts the event and
responds `202 { "ok": true }` immediately - callers should treat this as
fire-and-forget and not wait on it. `patientId` and `label` must be
non-empty strings; `payload`, when present, must be a flat object of
strings - only real fields the caller already has in scope, never invented
placeholders; invalid input gets a `400`.

Events for a patient are read back via `GET /api/patients/{id}/events`
(newest first) or, segmented into pipeline runs, via
`GET /api/patients/{id}/runs`. `GET /api/events/recent` and
`GET /api/events/stats` back the live ticker and the metrics row.

## Local SQLite storage

A local SQLite file (via bun's built-in `bun:sqlite`, chosen over
better-sqlite3 since this app already runs on bun and needs no native
module install step), queried through Drizzle (`src/lib/schema.ts`,
`src/lib/db.ts`), holds two independent tables:

- `events` - the per-patient event feed described above.
- `request_log` - every request this dashboard itself fires (currently just
  the "Trigger questionnaire" button): patient id, endpoint, timestamp, and
  status/response summary once it resolves.

Neither table is a cache of FHIR data. Schema changes go through
`bun run db:generate` (drizzle-kit, writes a new file under `drizzle/`);
`bun run db:migrate` applies pending migrations and runs once, before
`build`/`dev`/`start` (see `scripts/migrate.ts`) - the app itself never runs
DDL, so the several Next.js build worker processes that import `db.ts`
concurrently can't race each other creating or altering tables.

## Running

```
bun install
cp .env.example .env
bun dev
```

Runs on port 3003 by default (`bun --bun next dev`, matching front-desk-dashboard's
`bun --bun next start` pattern).

## Config

Copy `.env.example` to `.env` (gitignored):

- `CARE_LOOP_FHIR_SERVER_URL` - care-loop-fhir-server, host port `9091`
  (`localhost:9091/fhir` outside docker-compose;
  `care-loop-fhir-server-readonly-proxy` has no host port). Still used for
  the patient roster (names/DOB).
- `CARE_LOOP_AI_SERVICE_URL` - care-loop-ai-service, host port `8003`, used
  by the "Trigger questionnaire" button.
- `REQUEST_LOG_DB_PATH` - where the local SQLite file lives (`events` and
  `request_log` tables).

## docker-compose

Wired into the main stack as `care-loop-dashboard`, port `3003:3003`, with
the two URLs above pointed at the compose service names and a
`care-loop-dashboard-data` volume for the SQLite file. Comes up with
`docker compose up -d` / `make up` alongside everything else.
