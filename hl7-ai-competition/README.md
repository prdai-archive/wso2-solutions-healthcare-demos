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
  ingests Apple HealthKit samples (port 8000).
- [whatsapp-simulator](whatsapp-simulator/) — Next.js chat UI that renders a
  pushed questionnaire and posts the conversation transcript to a callback URL
  (port 3000).
- OpenEMR — open-source EHR run from the official `openemr/openemr` image with a
  MySQL sidecar (internal only). Web UI on port 3001 (default login
  `admin` / `pass`). First boot seeds the database and takes a few minutes.
- fhir-mcp-server — WSO2 FHIR R4 to MCP bridge (`wso2/fhir-mcp-server`) in front
  of OpenEMR, exposing the FHIR API as MCP tools on port 8001.

Run the stack with `make up`, or `make watch` to run it in the foreground and
rebuild on change.

`make up` runs `scripts/bootstrap-fhir.sh` twice, once per OAuth2 client it
registers and enables against OpenEMR: a read-only client for the MCP bridge
(`.fhir-mcp.env`) and a write-scoped client for `scripts/seed.ts`
(`.fhir-seed.env`, both gitignored). The script itself takes no built-in
client; callers pass CLIENT_NAME/SCOPES/ENV_FILE (see the Makefile). The
bridge starts under the `fhir` compose profile once its token exists. Re-run
`make fhir` to mint a new bridge token. The bridge reaches OpenEMR over the
internal Docker network in plain HTTP, since OpenEMR's FHIR endpoint uses a
self-signed cert the client will not trust; the OAuth2 token is still
required. Static-token mode is demo-grade; production should use the SMART
authorization-code grant instead.

### Seeding demo data

`make up` also runs `make seed`, which loads the single demo patient in
`scripts/seed-data/patient.json` into apple-healthkit-simulator's own REST API
and into OpenEMR via its FHIR API. Re-run `make seed` any time; it looks the
patient up by MRN (HealthKit side) and skips writing to a target that already
has it, so it is safe to re-run against a stack that has already been seeded.

OpenEMR's FHIR API in the pinned `8.0.0.3` image only supports `create` for
Patient/Practitioner/Organization/DocumentReference (confirmed via its own
CapabilityStatement) — Condition, Observation, and Encounter are read/search
only, so only the OpenEMR Patient is seeded via FHIR. OpenEMR also discards
any `identifier` submitted on create and assigns its own, so `scripts/seed.ts`
uses the healthkit-simulator's own `Patient.openemr_patient_uuid` column
(set by a `PATCH /patients/{uuid}/openemr-link` call right after creation) as
the durable link between the two systems' patient records, rather than a
shared identifier.

`scripts/seed.ts` runs on Bun. A POSIX-sh version, driving `docker compose
exec curl` the way `scripts/bootstrap-fhir.sh` does, would fit this repo's
existing zero-host-dependency pattern at least as well — Bun was used here
for the ability to write real request/response handling logic instead of
chained `curl` calls.

## Pre-commit hooks

ruff (apple-healthkit-simulator) and biome plus knip (whatsapp-simulator) run on
staged files at commit time. The config lives at
`hl7-ai-competition/.pre-commit-config.yaml`; install the hook pointing at it
once, from the fork root (needs `pre-commit`, e.g. `uv tool install pre-commit`;
the whatsapp-simulator hooks also need `bun`):

```sh
pre-commit install -c hl7-ai-competition/.pre-commit-config.yaml
```
