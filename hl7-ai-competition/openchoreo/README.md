# Care Loop on OpenChoreo

Replicates the Care Loop docker-compose stack as [OpenChoreo](https://openchoreo.dev)
components on a local k3d cluster. This is **additive**: the compose stack
(`../docker-compose.yml`, `make up`) is unchanged and remains the primary path.
This directory is a second deployment target for the same five services.

> Status: work in progress. The component descriptors and the install wrapper
> are in place; the deploy script, the token bootstrap Job, and end-to-end
> verification are still being built. See "Status" below.

## Model

OpenChoreo expresses workloads as Kubernetes CRDs rather than compose services.
Each compose service becomes a `Component` (its type) plus a `Workload` (the
container, env, endpoints, and cross-service dependencies), grouped under a
`Project`.

| compose service            | OpenChoreo component        | type                        | exposed |
| -------------------------- | --------------------------- | --------------------------- | ------- |
| whatsapp-simulator         | whatsapp-simulator          | deployment/web-application  | yes     |
| apple-healthkit-simulator  | apple-healthkit-simulator   | deployment/service          | yes     |
| openemr                    | openemr                     | deployment/web-application  | yes     |
| openemr-db                 | openemr-db                  | deployment/service          | no      |
| fhir-mcp-server            | fhir-mcp-server             | deployment/service          | yes     |

## Layout

```
openchoreo/
  project.yaml                 Care Loop project
  components/*.yaml             one Component + Workload per service
  install.sh                   install OpenChoreo on k3d (pinned v1.1.1, all planes)
  deploy.sh                    build/import images + apply components + mint token   (TODO)
  scripts/bootstrap-fhir-token.sh  kubectl-exec version of the compose token mint    (TODO)
```

## How it will run

```sh
./install.sh      # one-time: k3d cluster + OpenChoreo control/data/build/observability
./deploy.sh       # build images, k3d image import, kubectl apply, mint FHIR token
```

The FHIR token reuses the proven compose logic (`../scripts/bootstrap-fhir.sh`),
swapping `docker compose exec` for `kubectl exec`: register + enable an OpenEMR
OAuth2 client, widen the token TTL, mint, then write it to the `fhir-token`
Secret. `fhir-mcp-server` reads it via `env.valueFrom.secretKeyRef`.

## Known divergences from compose

- **No persistence.** OpenChoreo's `Workload` has no volume/PVC field, so
  `openemr`, `openemr-db`, and `apple-healthkit` SQLite storage are ephemeral.
  OpenEMR reseeds its schema on restart (the slow first-boot each time). Compose
  keeps named volumes; this does not.
- **Internal HTTP to OpenEMR is preserved.** The bridge still talks to OpenEMR
  over plain in-cluster HTTP to sidestep the self-signed cert; the OAuth2 token
  is still required.
- **Image source.** Local images (`whatsapp-simulator`, `apple-healthkit-simulator`,
  `care-loop/fhir-mcp-server`) are imported into k3d; `openemr` and `mysql` pull
  from public registries.

## Status

- [x] Project + five component/workload descriptors
- [x] `install.sh` reproducible OpenChoreo install (pinned v1.1.1)
- [ ] `deploy.sh` (image build/import + apply + token)
- [ ] `scripts/bootstrap-fhir-token.sh` (kubectl-exec token mint)
- [ ] End-to-end verification (endpoints reachable, MCP search returns a Bundle)
- [ ] `make` targets and resource-requirement notes
