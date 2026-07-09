# care-loop-dashboard

Internal ops dashboard for the Care Loop pipeline. Not a clinician-facing
tool like front-desk-dashboard - this is a live, per-patient visualization of
the demo pipeline itself (vitals in, ML scoring, questionnaire delivery,
agentic assessment, FHIR Task handoff), plus a way to manually fire a
questionnaire draft during a demo.

Built with Next.js 16 (App Router, TypeScript), Tailwind CSS v4, and the same
shadcn/ui component set as front-desk-dashboard, run with bun.

## What it shows

Selecting a patient renders their pipeline as a vertical, top-to-bottom
sequence of stages, each polled every 4s from real backend state - never
mocked or cached:

1. **Vitals ingested** - latest `Observation?subject=Patient/{id}` on
   care-loop-fhir-server.
2. **ML risk scoring** - a `RiskAssessment` whose `method.text` names
   care-loop-heart-risk-service.
3. **Questionnaire drafted** - inferred from the WhatsApp session's
   `createdAt` (care-loop-ai-service returns the draft directly and never
   persists it anywhere queryable), shown with an explicit "inferred" badge
   rather than a fabricated distinct timestamp.
4. **Sent via WhatsApp** / 5. **Patient responds** - from
   whatsapp-simulator's session list, filtered by patient.
5. **Agentic risk assessment** - the second `RiskAssessment`, whose
   `method.text` names care-loop-ai-service instead, with its reasoning in
   `note[].text`.
6. **FHIR Task created** - `Task?patient=Patient/{id}` on ehr-fhir-server.
7. **Clinician review** - not observable from this dashboard; shown as a
   permanently muted stage rather than guessed at.

If a patient hasn't gone through a stage yet, that stage says so plainly - it
does not fabricate data to fill the gap.

- **Generate questionnaire** - fires `POST /questionnaires` directly at
  care-loop-ai-service with `{patientId}`. This is fire-and-forget: the
  button sends the request, logs it, and returns immediately rather than
  blocking on the agent's response.

None of the above is cached or re-implemented here. Every read hits the real
service over HTTP on each poll.

## Local request log

A local SQLite file (via bun's built-in `bun:sqlite`, chosen over
better-sqlite3 since this app already runs on bun and `bun:sqlite` needs no
native module install step) logs every request this dashboard fires:
patient id, endpoint, timestamp, and status/response summary once it
resolves. It is a log of outbound dashboard actions only - never a cache of
FHIR data. See `src/lib/db.ts`.

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
  `care-loop-fhir-server-readonly-proxy` has no host port).
- `CARE_LOOP_AI_SERVICE_URL` - care-loop-ai-service, host port `8003`.
- `EHR_FHIR_SERVER_URL` - ehr-fhir-server, host port `9090` (used for the
  FHIR Task stage).
- `WHATSAPP_SIMULATOR_URL` - whatsapp-simulator, host port `3000` (used for
  the sent/responds stages).
- `REQUEST_LOG_DB_PATH` - where the local SQLite log file lives.

## docker-compose

Wired into the main stack as `care-loop-dashboard`, port `3003:3003`, with
the four URLs above pointed at the compose service names and a
`care-loop-dashboard-data` volume for the SQLite log. Comes up with
`docker compose up -d` / `make up` alongside everything else.
