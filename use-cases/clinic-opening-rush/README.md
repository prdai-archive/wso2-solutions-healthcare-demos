# Clinic Opening Rush

A Kubernetes autoscaling demo for the WSO2 FHIR server, built on k3d. It recreates the 8:00 am hospital rush: virtual users searching and updating a Synthea-seeded FHIR store, while the HorizontalPodAutoscaler adds FHIR server replicas and p95 latency holds. One over-provisioned Postgres backs every replica, and each pod's connection pool grows on its own.

## The scenario

The FHIR store is seeded with the [Synthea](https://synthetichealth.github.io/synthea-sample-data/) September 2019 R4 sample: 1,180 synthetic patients and roughly 76k resources. `make seed` downloads it once, loads each patient bundle as a FHIR transaction, and leaves the store holding a realistic mix of Patients, Encounters, Observations, Conditions, and more.

The [k6](k6/clinic-rush.ts) script then drives virtual users through a workflow over that data. Each iteration picks a random seeded patient and either:

- searches that patient's Observations (`Observation?patient=X&category=laboratory|vital-signs`), or
- picks one of the patient's Observations that carries a `valueQuantity` and updates it (`PUT Observation/{id}` with a revised value).

Roughly 80% of iterations are searches and 20% are updates, driven by a steady pool of 50 virtual users (configurable).

The punchline is the autoscaler: replicas climb from 2 toward the ceiling while p95 latency barely moves, and each new pod starts serving within seconds of being scheduled.

## Architecture

- **k3d cluster** `clinic-rush` — one server, no agents, Traefik disabled. Host ports: FHIR `9090`, Grafana `3000`, Prometheus `9091`.
- **Namespace** `clinic-rush` holds everything.
- **Postgres** — a single over-provisioned `StatefulSet` with a `local-path` PVC and `max_connections=1200`, sized so every replica's pool fits.
- **FHIR server** — a `ghcr.io/wso2/fhir-server:v2.1.0` Deployment starting at 2 replicas. Each pod opens its own pgx pool of up to `pool_max_conns=50` (`DATABASE_URL`), so total connections grow with the replica count. Reads and writes land on the same shared database. Pods run with `FHIR_CREATE_TABLES=false`: `make deploy` creates the schema once with a single bootstrap pod, because per-pod `CREATE TABLE` takes a table lock that deadlocks against live searches when the HPA adds replicas.
- **HPA** `fhir-server` — 2 to 20 replicas on two signals: CPU utilization and an external requests-per-second metric derived from k6 (`k6_http_reqs`). Scale-up is immediate; scale-down uses a 30s stabilization window so the demo visibly backs off.
- **Monitoring** — minimal Prometheus, Grafana, prometheus-adapter, and kube-state-metrics. Grafana provisions a `Clinic Opening Rush` dashboard (search/write p95 latency, request rate, VUs, and FHIR server / HPA replica counts), fed by k6 remote-write and cluster state.

## Prerequisites

Docker, [k3d](https://k3d.io) v5, `kubectl`, `helm` v3, and [k6](https://k6.io) v2 on the host. On amd64 these are the versions this use case was built against: k3d v5.9.0 (k3s v1.35.5), helm v3.21, k6 v2.3.0.

## Quickstart

```sh
cd use-cases/clinic-opening-rush
make up      # cluster + Postgres + FHIR server + HPA + monitoring
make seed    # download and load the Synthea sample dataset (once)
make load    # run the k6 rush (host terminal)
```

`make seed` downloads a ~85 MB zip and loads every patient bundle, so the first run takes several minutes. Set `LIMIT=200 make seed` to load only the first 200 patients.

Then open the dashboard at http://localhost:3000 (`admin` / `admin`) and watch it while `make load` runs. To see the replicas move, keep a terminal on:

```sh
kubectl -n clinic-rush get pods -w
```

Other targets:

```sh
make status   # pods, services, and HPA state
make stop     # stop the cluster, keep its data
make down     # delete the cluster
```

## Configuration

Edit the manifests under `k8s/` before `make up`, or `kubectl apply` after:

- `k8s/fhir.yaml` — replica floor, `pool_max_conns`, resource requests/limits.
- `k8s/hpa.yaml` — replica ceiling, CPU target, the `k6_http_reqs` target average.
- `k8s/postgres.yaml` — `max_connections`, `shared_buffers`, and the resource envelope.
- `k6/clinic-rush.ts` — the VU count and mix. Override with `VUS`, `DURATION`, `THINK_TIME`, `SEARCH_RATIO`, and `MAX_PATIENTS`.
- `scripts/seed.sh` — the dataset. Override `DATA_URL` (the sample zip), `LIMIT` (seed only the first N bundles), and `PARALLEL` (concurrent loads). Extracted data is cached under `k6/.synthea/` (gitignored).

Each k6 replica's pool is `pool_max_conns=50`, so the ceiling workload is `20 x 50 = 1000` connections. Postgres `max_connections=1200` leaves headroom for the monitoring stack.

## Known tradeoffs

- **The RPS signal is load-generator-derived.** It scales on the rate k6 sends (`k6_http_reqs`), so it tracks offered load, not server-side saturation. The FHIR server exposes real Prometheus metrics (`http_request_duration_seconds`, `fhir_request_total`) if you later want server-side signals for the HPA and the dashboard.
- **CPU rarely drives scaling here.** The workload is database-bound; CPU stays well under the 50% target, so the external RPS metric does the work.
- **Host sizing caps the demo.** Replicas request 250m CPU each, so all 20 fit an 8-CPU node. Postgres is provisioned generously (`max_connections=1200`); on a small host, lower the HPA ceiling and Postgres envelope together.
