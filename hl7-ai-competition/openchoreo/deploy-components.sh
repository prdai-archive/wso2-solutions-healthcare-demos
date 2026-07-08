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
load_image() {
  local image="$1" tar workdir
  workdir="$(mktemp -d)"
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

log "care-loop-ai-service needs openAiApiKey supplied out-of-band (never commit it):"
log "  kubectl create secret generic care-loop-ai-service-openai -n <dataplane-namespace> \\"
log "    --context=${KUBE_CONTEXT} --from-literal=openAiApiKey=<your-key>"
log "  kubectl set env deployment/<care-loop-ai-service-deploy> --context=${KUBE_CONTEXT} \\"
log "    -n <dataplane-namespace> --from=secret/care-loop-ai-service-openai"
log "Done. Check pod status with: kubectl get pods -A --context=${KUBE_CONTEXT}"
