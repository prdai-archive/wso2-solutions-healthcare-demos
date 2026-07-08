# OpenChoreo (primary deploy path)

This is now the primary way to run the Care Loop demo, via `make up`.
`docker-compose.yml` at the repo root is kept as a fallback (`make up-compose`
etc.) but is no longer the default. This directory holds the scripts that make
the OpenChoreo (github.com/openchoreo/openchoreo) deployment reproducible.

## What `install.sh` does

Installs OpenChoreo's control plane and data plane onto whatever kube context
you point it at, in this order:

1. Gateway API CRDs (v1.4.1)
2. cert-manager (v1.19.4)
3. External Secrets Operator (v2.0.1)
4. kgateway CRDs + controller (v2.2.1)
5. OpenBao (v0.25.6)
6. `openchoreo-control-plane` Helm chart (v1.1.1)
7. `openchoreo-data-plane` Helm chart (v1.1.1)

Versions and values files are taken from the official OpenChoreo docs
(openchoreo.dev/docs/getting-started/try-it-out/), not guessed. The script is
idempotent (`helm upgrade --install`) and exits non-zero on failure.

The script does not create a cluster. Point it at a cluster you've already
created.

## Prerequisites

- Docker
- `kind` (or another Kubernetes 1.32+ cluster with LoadBalancer support)
- `helm` 3.12+
- `kubectl` v1.32+

If using `kind`, pin the node image to Kubernetes 1.32+, e.g.:

```bash
kind create cluster --image kindest/node:v1.32.0
```

`kind`'s stock default node image is older than 1.32 and OpenChoreo's CRDs
fail to install against it with a CEL compilation error.

## Usage

```bash
kind create cluster --name openchoreo-migration --image kindest/node:v1.32.0
./install.sh kind-openchoreo-migration
./deploy-components.sh openchoreo-migration kind-openchoreo-migration
```

`install.sh` sets up the platform (control plane, data plane, seeded
Project/Environment/ClusterComponentTypes). `deploy-components.sh` builds
every service's image, loads it directly into the kind cluster's containerd
(no registry needed), and applies each service's `component.yaml`.

If no context is given to `install.sh`, it uses the current `kubectl` context.

## Verified status (2026-07-08)

All 11 components (10 services + `ehr-fhir-server-db`) reach `Running` and
were curl-verified reachable. `care-loop-ai-service` was verified with a real
end-to-end call: `POST /questionnaires` returned `201` with a real
AI-generated FHIR `Questionnaire`, using a real `openAiApiKey` supplied via a
live Kubernetes Secret (never committed).

The full emergency workflow was subsequently verified end to end on
OpenChoreo, from a completely clean machine state (no prior kind cluster or
images): seeded demo patients, one EHR-to-care-loop sync cycle
(`scripts/sync` run once against port-forwarded services), then
`POST /vitals-cron/run-now` on apple-healthkit-simulator drove vitals ->
care-loop-collector-service -> care-loop-analysis-service -> ML heart-risk
(probability 0.91, escalated) -> AI-generated emergency questionnaire ->
whatsapp-simulator answer submission -> agentic risk assessment (0.95) ->
`Task` (priority `stat`) created in ehr-fhir-server, with both
`RiskAssessment`s and the `QuestionnaireResponse` saved in
care-loop-fhir-server. The below-threshold patient correctly produced only an
ML `RiskAssessment` (0.34) with no escalation.

Five real issues were found and fixed along the way, kept here since they'll
bite again if the mechanism changes upstream:

- The ClusterComponentType `deployment/service` defaults every container to
  256Mi/100m. That OOM-killed care-loop-fhir-server (HAPI wants ~1Gi) and the
  Ballerina/JVM services. `Component.spec.parameters` does not actually feed
  `environmentConfigs` in v1.1 (a `parameters` patch never reached the
  Deployment); the auto-created ReleaseBinding's
  `componentTypeEnvironmentConfigs` is what the renderer consumes, so
  `deploy-components.sh` patches those after applying the manifests.
- `docker save -o` into a `mktemp -d` directory fails under snap-confined
  docker (`/snap/bin/docker` has a private `/tmp`), with "invalid output
  path". `deploy-components.sh` stages image tars under the repo instead.
- care-loop-collector-service and care-loop-analysis-service read all their
  endpoint URLs from Config.toml-backed configurables, and
  apple-healthkit-simulator reads its vitals target from `HEALTHKIT_*` env
  vars. None of these were wired on OpenChoreo, so the services silently ran
  against `localhost` defaults (and the vitals forwarder was a no-op). Their
  component.yamls now mount a Config.toml / set the env explicitly.
- Once a `Config.toml` is mounted via the Workload's `container.files` (needed
  for `openAiApiKey`, a required configurable with no default), Ballerina
  stops honoring the separate env-var override for other configurables, so
  `fhirMcpUrl` silently fell back to its coded-in `localhost:8001` default —
  unreachable in the pod. Fixed by setting `fhirMcpUrl` directly inside the
  mounted `Config.toml` instead of relying on an env var for it.
- The long, fully-qualified dependency address OpenChoreo's
  `envBindings` mechanism injects
  (`<component>.<namespace>.svc.cluster.local`) resolved intermittently under
  this cluster's DNS; the short in-namespace service name resolved reliably
  in repeated testing and is what's actually used, matching the exact
  hostname style docker-compose already used successfully.

`openAiApiKey` must be supplied out-of-band, never committed. Update
`care-loop-ai-service/.choreo/component.yaml`'s mounted `Config.toml` value
with a live Secret rather than editing the placeholder in the checked-in
file:

```bash
kubectl create secret generic care-loop-ai-service-realconfig -n <dataplane-namespace> \
  --from-literal=Config.toml='listenPort = 8003
fhirMcpUrl = "http://fhir-mcp-server:8000/mcp"
openAiApiKey = "<your-real-key>"'
kubectl patch deployment/<care-loop-ai-service-deployment> -n <dataplane-namespace> --type=json \
  -p='[{"op":"replace","path":"/spec/template/spec/volumes/0","value":{"name":"<existing-volume-name>","secret":{"secretName":"care-loop-ai-service-realconfig"}}}]'
```

## OpenChoreo MCP server (optional, local development)

OpenChoreo's control plane API also serves an MCP endpoint at `/mcp`
(openchoreo.dev/docs/ai/mcp-servers/). The documented authentication flow
depends on Thunder (OIDC), which this install intentionally omits, so for
this local kind cluster the API's authentication is switched off instead.
Do not do this on any shared or non-local deployment:

```bash
helm --kube-context kind-openchoreo-migration upgrade openchoreo-control-plane \
  oci://ghcr.io/openchoreo/helm-charts/openchoreo-control-plane --version 1.1.1 \
  -n openchoreo-control-plane --reuse-values --set security.enabled=false
kubectl --context kind-openchoreo-migration port-forward \
  -n openchoreo-control-plane svc/openchoreo-api 18080:8080 &
claude mcp add --transport http openchoreo-cp http://localhost:18080/mcp
```

Verified working: `initialize` over the port-forward returns the
`openchoreo-api` MCP server info and Claude Code reports the server
`Connected`. The observability MCP server (`openchoreo-obs`) requires the
observability plane, which is not part of this install.
