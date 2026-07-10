# care-loop-dashboard

Internal ops dashboard for the Care Loop. Not a clinician-facing tool like
front-desk-dashboard - this is a live, per-patient event feed of what the
other Care Loop services are doing (vitals in, ML scoring, questionnaire
delivery, agentic assessment, FHIR Task handoff), plus a way to manually fire
a questionnaire draft during a demo.

Built with Next.js 16 (App Router, TypeScript), Tailwind CSS v4, and the same
shadcn/ui component set as front-desk-dashboard, run with bun.

## What it shows

This dashboard does not poll or infer state from FHIR or whatsapp-simulator.
Instead, other backend services POST a simple event to this dashboard
whenever something happens for a patient, and the dashboard just stores and
displays those events as a per-patient timestamped feed.

Selecting a patient renders their events in reverse-chronological order,
polled every 4s. Each event shows its label, an optional detail string, and
the time it was received. If a patient has no events yet, the feed says so
plainly.

- **Generate questionnaire** - fires `POST /questionnaires` directly at
  care-loop-ai-service with `{patientId}`. This is fire-and-forget: the
  button sends the request, logs it, and returns immediately rather than
  blocking on the agent's response.

## Event ingestion contract

Other services report progress by POSTing to this dashboard directly:

```
POST /api/events
Content-Type: application/json

{ "patientId": "string", "label": "string", "detail": "string (optional)" }
```

No auth (internal network only). The dashboard inserts the event and
responds `202 { "ok": true }` immediately - callers should treat this as
fire-and-forget and not wait on it. `patientId` and `label` must be
non-empty strings; invalid input gets a `400`.

Events for a patient are read back via `GET /api/patients/{id}/events`,
which returns `{ "events": [...] }` ordered newest first.

## Local SQLite storage

A local SQLite file (via bun's built-in `bun:sqlite`, chosen over
better-sqlite3 since this app already runs on bun and `bun:sqlite` needs no
native module install step) holds two independent tables:

- `events` - the per-patient event feed described above.
- `request_log` - every request this dashboard itself fires (currently just
  the "Trigger questionnaire" button): patient id, endpoint, timestamp, and
  status/response summary once it resolves.

Neither table is a cache of FHIR data. See `src/lib/db.ts`.

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
