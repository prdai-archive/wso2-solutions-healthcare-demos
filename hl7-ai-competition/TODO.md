# TODO

## Wire up WSO2 Agent Manager for care-loop-ai-service

Deferred, not skipped - key facts so this doesn't need re-researching:

- No docker-compose-only mode exists upstream (`wso2/agent-manager`
  discussion #989 confirms it's an open, unimplemented request).
  `CreateAgent` calls OpenChoreo's `GetOrganization`/`CreateComponent`
  unconditionally, even for externally-hosted agents - OpenChoreo is
  load-bearing for registration, not just platform build/deploy.
- OpenChoreo needs k3d (Kubernetes-in-Docker, still just Docker containers,
  no external infra): `docker run --rm -it --network=host -v /var/run/docker.sock:/var/run/docker.sock ghcr.io/openchoreo/quick-start:v1.1.1`
  then `./install.sh`. Cluster/network name is `k3d-openchoreo`, not
  `k3d-openchoreo-local-setup` as agent-manager's compose file assumes.
- Thunder (moved to `asgardeo/thunder`) and OpenBao both have simple
  standalone Docker images (sqlite-backed, no k8s) if OpenChoreo's own
  bundled OpenBao doesn't collide with a separate one.
- Blocked on hardware: OpenChoreo alone wants 8GB RAM/4CPU with its
  WorkflowPlane feature (4GB/2CPU minimum without it) - this box has 15GB
  total, already at OpenChoreo's own ceiling before Thunder + OpenBao +
  Agent Manager's Postgres+Go+React stack. Needs a bigger box or a remote
  environment.
