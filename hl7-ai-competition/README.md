# WSO2 Care Loop

An AI-assisted care loop connecting remote patients with a heart clinic, built
for the HL7 AI competition. Patient-side home monitoring and messaging feed an
agent-driven engine that converts incoming data to FHIR, predicts risk, and
routes clinical notifications and telehealth back to the care team. Integrations
run on Ballerina.

## Architecture

![WSO2 Care Loop architecture](assets/architecture-diagram-v2.png)

Earlier stages: [v1](assets/architecture-diagram-v1.png),
[whiteboard sketch](assets/whiteboard-sketch.png).

## Components

- [apple-healthkit-simulator](apple-healthkit-simulator/) — FastAPI service that
  ingests Apple HealthKit samples for multiple patients (port 8000).
- [whatsapp-simulator](whatsapp-simulator/) — Next.js chat UI that renders a
  pushed questionnaire and posts the conversation transcript to a callback URL
  (port 3000).
- fhir-server — WSO2 FHIR R4 server (`wso2/fhir-server`, Go + Postgres) standing
  in for an EHR/EMR's FHIR API. Port 9090 (`/fhir/r4`). Has no auth of its own;
  fine for this local demo, put a gateway/auth proxy in front for anything real.
- fhir-mcp-server — WSO2 FHIR R4 to MCP bridge (`wso2/fhir-mcp-server`) in front
  of fhir-server, exposing the FHIR API as MCP tools on port 8001.
- [vitals-cron-service](vitals-cron-service/) — FastAPI service that, hourly,
  forwards each patient's last-hour vitals from apple-healthkit-simulator to
  fhir-server as FHIR `Observation`s (port 8003).

Run the stack with `make up`, or `make watch` to run it in the foreground and
rebuild on change.

This previously ran against OpenEMR (OAuth2 client registration via
`scripts/bootstrap-fhir.sh`, a MySQL sidecar, etc.). That's been removed:
OpenEMR's FHIR API in the pinned `8.0.0.3` image only supported `create` for
Patient/Practitioner/Organization/DocumentReference, and its Standard
(non-FHIR) API's Vitals endpoint crashed on every request authenticated via
OAuth2 bearer token alone (`VitalsCalculatedService` reads a session key that
bearer-token auth never populates — a genuine upstream bug, unfixed in that
release branch, no clean workaround). fhir-server has full CRUD on every
resource type and no auth to configure at all, so it replaces OpenEMR as the
EHR/EMR stand-in for this demo.

### Seeding demo data

`make up` also runs `make seed`, which:

1. Runs `scripts/seed.ts`: loads the three demo patients in
   `scripts/seed-data/patients.json` (one stable, one borderline, one at-risk)
   into apple-healthkit-simulator's own REST API and into fhir-server as FHIR
   `Patient`/`Encounter`/`Condition`/`Observation` resources. Idempotent per
   patient per target — it looks each patient up by MRN (HealthKit side) or by
   the linked FHIR `Patient.id` (fhir-server side) and skips a target that
   already has it, so it's safe to re-run against an already-seeded stack.
   apple-healthkit-simulator's `Patient.fhir_patient_id` column (set via
   `PATCH /patients/{uuid}/fhir-link` right after the FHIR `Patient` is
   created) is the durable link between the two systems' patient records.
2. Runs `scripts/seed-vitals-timeline.ts`: pre-seeds the next 24 hours of
   hourly vitals (heart rate, SpO2, respiratory rate, blood pressure) per
   patient into apple-healthkit-simulator only, timestamped into the future
   from "now". Not idempotent by design — it runs every `make seed` so there's
   always a fresh future window for vitals-cron-service to discover as real
   time passes. Ranges per patient are grounded in AHA blood-pressure
   categories and standard vitals norms (stable/borderline/at-risk severity
   tiers).

vitals-cron-service then picks up each hour's worth of readings as real time
reaches them and forwards them to fhir-server as `Observation`s — simulating
a continuously-streaming remote monitor without needing the seed step itself
to run on a schedule.

`scripts/seed.ts` and `scripts/seed-vitals-timeline.ts` run on Bun.
[Ballerina](https://ballerina.io) was evaluated as an alternative (its
`ballerina/http` client and `ballerina/task` scheduler are a real fit for this
kind of integration script) but not adopted yet — kept as a follow-up rather
than doing a language rewrite in the same pass as the OpenEMR-to-fhir-server
migration.

## Pre-commit hooks

ruff (apple-healthkit-simulator) and biome plus knip (whatsapp-simulator) run on
staged files at commit time. The config lives at
`hl7-ai-competition/.pre-commit-config.yaml`; install the hook pointing at it
once, from the fork root (needs `pre-commit`, e.g. `uv tool install pre-commit`;
the whatsapp-simulator hooks also need `bun`):

```sh
pre-commit install -c hl7-ai-competition/.pre-commit-config.yaml
```
