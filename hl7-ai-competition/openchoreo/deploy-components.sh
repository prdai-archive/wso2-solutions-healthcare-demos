#!/usr/bin/env bash
# Builds every service's image, loads it into the given kind cluster's containerd (no registry
# needed), and applies its Component+Workload. Run after install.sh. Requires a kind cluster.
set -euo pipefail

KIND_CLUSTER="${1:?usage: deploy-components.sh <kind-cluster-name> [kube-context]}"
KUBE_CONTEXT="${2:-kind-${KIND_CLUSTER}}"
KCTL="kubectl --context=${KUBE_CONTEXT}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_CONTAINER="${KIND_CLUSTER}-control-plane"

log() { echo "==> $*"; }

# `kind load docker-image` fails intermittently in some sandboxed docker setups (digest
# mismatches / tmpfs quirks under /tmp). This save-and-import path is what actually worked.
# The tar staging dir must not be under /tmp either: snap-confined docker (/snap/bin/docker)
# has a private /tmp, so `docker save -o /tmp/...` fails with "invalid output path: stat ...:
# no such file or directory". Stage under the repo, which docker and this shell both see.
load_image() {
  local image="$1" tar workdir
  workdir="$(mktemp -d "${REPO_ROOT}/.image-staging.XXXXXX")"
  trap 'rm -rf "${workdir}"' RETURN
  tar="${workdir}/img.tar"
  docker save "${image}" -o "${tar}"
  docker cp "${tar}" "${NODE_CONTAINER}:/img.tar"
  docker exec "${NODE_CONTAINER}" ctr -n k8s.io images import /img.tar >/dev/null 2>&1 || true
  rm -rf "${workdir}"
}

# service -> build context (docker-compose.yml's build.context for each)
declare -A BUILD_CONTEXTS=(
  [apple-healthkit-simulator]="${REPO_ROOT}/apple-healthkit-simulator"
  [care-loop-heart-risk-service]="${REPO_ROOT}/care-loop-heart-risk-service"
  [whatsapp-simulator]="${REPO_ROOT}/whatsapp-simulator"
  [front-desk-dashboard]="${REPO_ROOT}/front-desk-dashboard"
  [care-loop-ai-service]="${REPO_ROOT}/care-loop-ai-service"
  [care-loop-collector-service]="${REPO_ROOT}/care-loop-collector-service"
  [care-loop-analysis-service]="${REPO_ROOT}/care-loop-analysis-service"
  [ehr-fhir-server]="https://github.com/wso2/fhir-server.git#v0.5.0"
  [fhir-mcp-server]="https://github.com/wso2/fhir-mcp-server.git#0.10.0"
)

for svc in "${!BUILD_CONTEXTS[@]}"; do
  log "Building ${svc}:openchoreo"
  docker build -q -t "${svc}:openchoreo" "${BUILD_CONTEXTS[$svc]}" >/dev/null
  log "Loading ${svc}:openchoreo into ${KIND_CLUSTER}"
  load_image "${svc}:openchoreo"
done

# Public images used directly, no build/load-as-local-tag needed, but still must exist in
# containerd since imagePullPolicy is Never for these Components too.
for image in postgres:16-alpine hapiproject/hapi:v8.10.0-2; do
  log "Loading public image ${image} into ${KIND_CLUSTER}"
  docker pull -q --platform linux/amd64 "${image}" >/dev/null
  load_image "${image}"
done

log "Applying Component/Workload manifests"
for f in \
  "${REPO_ROOT}/ehr-fhir-server-db/.choreo/component.yaml" \
  "${REPO_ROOT}/apple-healthkit-simulator/component.yaml" \
  "${REPO_ROOT}/care-loop-heart-risk-service/component.yaml" \
  "${REPO_ROOT}/whatsapp-simulator/component.yaml" \
  "${REPO_ROOT}/ehr-fhir-server/component.yaml" \
  "${REPO_ROOT}/care-loop-fhir-server/.choreo/component.yaml" \
  "${REPO_ROOT}/fhir-mcp-server/.choreo/component.yaml" \
  "${REPO_ROOT}/front-desk-dashboard/.choreo/component.yaml" \
  "${REPO_ROOT}/care-loop-ai-service/.choreo/component.yaml" \
  "${REPO_ROOT}/care-loop-collector-service/.choreo/component.yaml" \
  "${REPO_ROOT}/care-loop-analysis-service/.choreo/component.yaml"; do
  ${KCTL} apply -f "${f}"
done

# The seeded deployment/service ClusterComponentType defaults every container to 256Mi/100m.
# That OOM-kills the JVM-based services: care-loop-fhir-server (HAPI needs ~1Gi) and the four
# Ballerina services were all observed OOMKilled/crashlooping with the defaults. Component
# spec.parameters does NOT feed environmentConfigs in v1.1 (verified: a parameters patch never
# reached the Deployment); the ReleaseBinding's componentTypeEnvironmentConfigs is what the
# renderer actually consumes, so patch the autoDeploy-created ReleaseBindings here.
log "Raising memory for JVM-based components (ClusterComponentType default 256Mi OOM-kills them)"
patch_resources() {
  local rb="$1" requests="$2" limits="$3" attempt
  for attempt in 1 2 3 4 5 6; do
    if ${KCTL} patch releasebinding "${rb}" -n default --type=merge \
      -p "{\"spec\":{\"componentTypeEnvironmentConfigs\":{\"resources\":{\"requests\":${requests},\"limits\":${limits}}}}}" 2>/dev/null; then
      return 0
    fi
    log "ReleaseBinding ${rb} not created yet (attempt ${attempt}/6), retrying"
    sleep 10
  done
  log "ERROR: ReleaseBinding ${rb} never appeared"
  return 1
}
patch_resources care-loop-fhir-server-development '{"cpu":"250m","memory":"1024Mi"}' '{"cpu":"1","memory":"1536Mi"}'
for rb in ehr-fhir-server-development care-loop-ai-service-development \
  care-loop-collector-service-development care-loop-analysis-service-development; do
  patch_resources "${rb}" '{"cpu":"100m","memory":"512Mi"}' '{"cpu":"1","memory":"768Mi"}'
done

log "care-loop-ai-service needs openAiApiKey supplied out-of-band (never commit it):"
log "  kubectl create secret generic care-loop-ai-service-openai -n <dataplane-namespace> \\"
log "    --context=${KUBE_CONTEXT} --from-literal=openAiApiKey=<your-key>"
log "  kubectl set env deployment/<care-loop-ai-service-deploy> --context=${KUBE_CONTEXT} \\"
log "    -n <dataplane-namespace> --from=secret/care-loop-ai-service-openai"
log "Done. Check pod status with: kubectl get pods -A --context=${KUBE_CONTEXT}"
