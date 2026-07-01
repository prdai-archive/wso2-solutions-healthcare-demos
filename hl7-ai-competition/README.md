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
  ingests Apple HealthKit samples for multiple patients (port 8000). Also runs
  an in-process hourly job (`src/app/vitals_forwarder.py`) that builds a FHIR
  `Observation` bundle from each patient's last-hour vitals and forwards it to
  `HEALTHKIT_VITALS_TARGET_URL` (unset by default — no downstream consumer
  exists yet, so the job just builds the bundle and skips the POST). Manually
  trigger a cycle with `POST /vitals-cron/run-now`, check the last result with
  `GET /vitals-cron/status`.
- [whatsapp-simulator](whatsapp-simulator/) — Next.js chat UI that renders a
  pushed questionnaire and posts the conversation transcript to a callback URL
  (port 3000).
- fhir-server — WSO2 FHIR R4 server (`wso2/fhir-server`, Go + Postgres) standing
  in for an EHR/EMR's FHIR API. Port 9090 (`/fhir/r4`). Has no auth of its own;
  fine for this local demo, put a gateway/auth proxy in front for anything real.
- fhir-mcp-server — WSO2 FHIR R4 to MCP bridge (`wso2/fhir-mcp-server`) in front
  of fhir-server, exposing the FHIR API as MCP tools on port 8001. Reaches
  fhir-server through fhir-server-readonly-proxy (nginx), which 403s anything
  but GET/HEAD, so the bridge can only read.
- [care-loop-ai-service](care-loop-ai-service/) — standalone Ballerina agent
  (port 8003). `POST /questionnaires` with a `patientId` pulls that patient's
  recent Observations from fhir-mcp-server (MCP `search` tool) and asks Gemini
  to draft a FHIR `Questionnaire` (questions only, no answers) targeted at the
  vitals trend. Not wired into the rest of the loop yet — this is a standalone
  component for now. Needs a `Config.toml` (copy `Config.toml.example`) with a
  real `geminiApiKey`; gitignored, never commit it.

Run the stack with `make up`, or `make watch` to run it in the foreground and
rebuild on change.

### Observability

care-loop-ai-service exports OpenTelemetry traces via `ballerinax/amp`
straight to Jaeger's native OTLP/HTTP receiver (port 4318) — no otel-collector
in between. View traces at `http://localhost:16686`.

We looked at wiring this up through WSO2 Agent Manager (`wso2/agent-manager`)
instead, since that's the actual product for registering/observing agents.
Its own `docker-compose.yml` hard-requires a running k3d + OpenChoreo +
Thunder + OpenBao cluster for auth and secrets — it isn't designed to run
standalone, so wiring it in as-is wasn't possible without forking and
stripping those dependencies out. Went with plain Jaeger for now; Agent
Manager registration is a follow-up if we stand up the full cluster.

### Seeding demo data

`make up` also runs `make seed`, which runs `scripts/seed/index.ts` (Bun):
loads the three demo patients in `scripts/seed/data/patients.json` (one
stable, one borderline, one at-risk) into apple-healthkit-simulator's own
REST API and into fhir-server as FHIR `Patient`/`Encounter`/`Condition`/
`AllergyIntolerance`/`MedicationRequest`/`Observation` resources, then seeds
the next 24 hours of hourly vitals (heart rate, SpO2, respiratory rate, blood
pressure) per patient into apple-healthkit-simulator only, timestamped into
the future from "now". apple-healthkit-simulator's `Patient.fhir_patient_id`
column (set via `PATCH /patients/{uuid}/fhir-link`) links the two systems'
patient records.

apple-healthkit-simulator's hourly job picks up each hour's worth of readings
as real time reaches them, ready to forward once `HEALTHKIT_VITALS_TARGET_URL`
points at a real consumer.

## Logging

apple-healthkit-simulator and care-loop-heart-risk-service log via
[loguru](https://github.com/Delgan/loguru) (`from loguru import logger`) to
stdout. whatsapp-simulator logs via `consola` (`src/lib/logger.ts`).
front-desk-dashboard has no server-side code, so nothing to log.

## Pre-commit hooks

ruff (apple-healthkit-simulator), biome plus knip (whatsapp-simulator), and
`bal format` plus `bal scan` (care-loop-ai-service) run on staged files at
commit time. The config lives at `hl7-ai-competition/.pre-commit-config.yaml`;
install the hook pointing at it once, from the fork root (needs
`pre-commit`, e.g. `uv tool install pre-commit`; the whatsapp-simulator hooks
also need `bun`, care-loop-ai-service needs `bal`):

```sh
pre-commit install -c hl7-ai-competition/.pre-commit-config.yaml
```
