# Clinic Opening Rush - Agent Notes

## Project context

This use case is a self-contained Kubernetes autoscaling demo for the WSO2 FHIR server, entirely under `use-cases/clinic-opening-rush/`. The wider repository is a general WSO2 healthcare-demos repo, so keep changes scoped here and leave the rest alone.

`README.md` describes the scenario, architecture, and targets. The implementation lives in `k8s/` (Postgres, FHIR server, HPA), `monitoring/` (Prometheus, Grafana, prometheus-adapter, dashboard), `k6/` (the load script), and `scripts/` + `Makefile` (bring-up).

## Operating rules

- Follow the user's requested scope exactly. Do not expand into unrelated work.
- Every decision is the user's. Put concrete options to the user rather than choosing for them.
- Prefer small changes and repo-native tooling (k3d, helm, k6, kubectl). Do not add new dependencies without asking.

## Conventions

- No emoji anywhere.
- WSO2 license header on new source files (`Makefile`, `scripts/*.sh`, `k6/*.js`). Kubernetes manifests follow the existing repo style and carry no header.
- PRs go to the `origin` fork only, never to `upstream` (`wso2/solutions-healthcare-demos`). This use case targets `origin/main`.

## Verification

- Bring up with `make up` and exercise with `make load`.
- After changing manifests, re-run `kubectl -n clinic-rush get pods,svc,hpa` and the dashboard queries.
- Report exactly what was verified and what was not.
