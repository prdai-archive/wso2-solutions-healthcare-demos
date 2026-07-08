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

Two real issues were found and fixed along the way, kept here since they'll
bite again if the mechanism changes upstream:

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
