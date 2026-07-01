# TODO

## Wire up WSO2 Agent Manager for care-loop-ai-service

Currently care-loop-ai-service just sends traces straight to Jaeger via
`ballerinax/amp` (see README "Observability"). Real Agent Manager
registration is deferred, not skipped for good - here's what's actually
required, so this doesn't need re-researching from scratch:

- No docker-compose-only mode exists upstream. Confirmed via
  `wso2/agent-manager` discussion #989: "Add an installation script for AM
  on a VM with Docker" is an open, unimplemented request. `CreateAgent`
  calls OpenChoreo's `GetOrganization`/`CreateComponent` unconditionally,
  even for externally-hosted agents (`agent_manager.go`) - OpenChoreo isn't
  just for platform-hosted build/deploy, it's load-bearing for registration
  itself.
- OpenChoreo is Kubernetes-native; the only way to get it running short of
  a real k8s cluster is k3d (Kubernetes-in-Docker, still just Docker
  containers on one box, no external infra). Official quick-start:
  `docker run --rm -it --network=host -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/openchoreo/quick-start:v1.1.1`
  then `./install.sh`. Cluster name is `openchoreo` (Docker network
  `k3d-openchoreo`), not `k3d-openchoreo-local-setup` as
  agent-manager's compose file assumes - check that before wiring the
  network join.
- Thunder (`asgardeo/thunder`, WSO2's identity server - `wso2/thunder` has
  moved/renamed there) and OpenBao both have genuinely simple standalone
  Docker images, sqlite-backed, no k8s needed on their own:
  - OpenBao: `openbao/openbao:2.1.0`, dev mode, single container.
  - Thunder: `install/quick-start/docker-compose.yml` in their repo, plain
    compose, no k8s.
  - Watch for a possible OpenBao collision: OpenChoreo's own quick-start
    bundles OpenBao by default for its control plane secrets.
- Thunder's JWKS-based JWT auth (`KEY_MANAGER_JWKS_URL`) gates every
  `/api/v1/*` request in agent-manager-service; internal routes (trace
  ingestion via gateway/websocket) bypass JWT and use API-key header auth
  instead.
- Blocked on hardware today: OpenChoreo alone recommends 8GB RAM/4CPU with
  its WorkflowPlane (build) feature enabled, 4GB/2CPU minimum without it.
  This box has 15GB total RAM - that's already at OpenChoreo's own ceiling
  before adding Thunder + OpenBao + Agent Manager's Postgres+Go+React stack
  on top. Needs a bigger box (or a remote/cloud environment) before
  attempting this for real.
