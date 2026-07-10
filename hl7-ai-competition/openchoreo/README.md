# OpenChoreo (primary deploy path)

The primary way to run the Care Loop demo is `make up`; docker-compose stays
as a fallback. These scripts make the OpenChoreo deployment reproducible on a
plain kind cluster.

## Prerequisites

Docker, `helm` 3.12+, `kubectl` v1.32+, and a Kubernetes 1.32+ cluster —
with kind, pin the node image (`kindest/node:v1.32.0`); the stock image is
older and OpenChoreo's CRDs fail with a CEL compilation error.

## Usage

```bash
make up             # kind cluster + install.sh + deploy-components.sh + seed
make seed           # (re)seed demo data and trigger an immediate EHR -> care-loop sync
make trigger-vitals # force a vitals-forward cycle instead of waiting for the cron
make forward        # port-forward every service onto its compose-equivalent host port
make ps / make down
```

`install.sh` installs, in order: Gateway API CRDs v1.4.1, cert-manager
v1.19.4, External Secrets Operator v2.0.1, kgateway v2.2.1, OpenBao v0.25.6,
then the OpenChoreo control- and data-plane charts v1.1.1 (versions/values
from the official docs). It's idempotent and doesn't create the cluster.
`deploy-components.sh` builds each image, loads it into the cluster's
containerd (no registry), pushes the local Config.tomls into OpenBao (see
below), and applies every `component.yaml` - including `fhir-sync`, the
hourly EHR -> care-loop sync worker (`deployment/worker`, no endpoints),
so syncing runs continuously in-cluster exactly as it does on compose.

## Verified status (2026-07-08, store swapped to wso2/fhir-server 2026-07-09)

care-loop-fhir-server now runs github.com/wso2/fhir-server v0.5.0 (with its
own postgres, `care-loop-fhir-server-db`) instead of HAPI, in both
docker-compose and OpenChoreo; all clients use `:9090/fhir/r4`. Capability
checked before the swap: transaction Bundles, resource creates, and
code-filtered Observation searches all pass against wso2/fhir-server.

All components (12 with the care-loop store's own postgres) reach `Running`, and the full emergency workflow was
verified end to end from a clean machine state: seeded patients, one
`scripts/sync` cycle, then `POST /vitals-cron/run-now` drove vitals ->
collector -> analysis -> ML heart-risk 0.91 (escalated) -> AI-generated
questionnaire -> whatsapp answers -> agentic risk 0.95 -> `stat` `Task` in
ehr-fhir-server, with both `RiskAssessment`s and the `QuestionnaireResponse`
in care-loop-fhir-server. A real `openAiApiKey` was supplied via a live
Secret (never committed).

Real issues found and fixed (they'll bite again if upstream changes):

- The `deployment/service` ClusterComponentType defaults containers to
  256Mi/100m, OOM-killing the JVM services. `Component.spec.parameters`
  never reaches the Deployment in v1.1 (it maps only to a ComponentType's
  `parameters` schema; `resources`/`imagePullPolicy` live in the
  `environmentConfigs` schema, read from the ReleaseBinding) - so each JVM
  service's component.yaml declares its ReleaseBinding with the memory
  override, applied like any other manifest.
- `docker save -o` into `mktemp -d` fails under snap-confined docker
  (private `/tmp`); image tars are staged under the repo instead.
- collector/analysis read endpoint URLs from Config.toml configurables and
  the healthkit simulator reads `HEALTHKIT_*` env vars — none were wired on
  OpenChoreo, so everything silently used `localhost` defaults. The
  component.yamls now mount a Config.toml / set the env.
- Once a Config.toml is mounted, Ballerina stops honoring env-var overrides
  for other configurables — all values must live in the mounted file.
- The FQDN that `envBindings` injects resolved intermittently under this
  cluster's DNS; short in-namespace service names (compose's exact style)
  are used instead.

## Config.toml / openAiApiKey

The three Ballerina services resolve their Config.toml through OpenChoreo's
native secret-store path: `deploy-components.sh` pushes each service's local
gitignored `Config.toml` (the same file docker-compose mounts - hostnames
already match in-cluster) into OpenBao and creates a `SecretReference`; the
Workload's `files[].valueFrom.secretKeyRef` then renders it as an
ExternalSecret-synced Kubernetes Secret mounted into the pod. Config values
live in exactly one place and the real `openAiApiKey` never touches git.
Those three local files are required, as they are for docker-compose.

## OpenChoreo MCP server (optional, local development)

The control-plane API serves MCP at `/mcp`. The documented auth needs
Thunder (OIDC), which this install omits, so auth is switched off — local
kind cluster only, never on a shared deployment:

```bash
helm --kube-context kind-care-loop upgrade openchoreo-control-plane \
  oci://ghcr.io/openchoreo/helm-charts/openchoreo-control-plane --version 1.1.1 \
  -n openchoreo-control-plane --reuse-values --set security.enabled=false
kubectl --context kind-care-loop port-forward \
  -n openchoreo-control-plane svc/openchoreo-api 18080:8080 &
claude mcp add --transport http openchoreo-cp http://localhost:18080/mcp
```

Verified `Connected` from Claude Code. The observability MCP server needs
the observability plane, which isn't installed.
