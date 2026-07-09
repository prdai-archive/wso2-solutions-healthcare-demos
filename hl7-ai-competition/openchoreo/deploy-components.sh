#!/usr/bin/env bash
# Builds each service image, loads it into the kind cluster's containerd (no registry), applies its Component+Workload. Run after install.sh.
set -euo pipefail

KIND_CLUSTER="${1:?usage: deploy-components.sh <kind-cluster-name> [kube-context]}"
KUBE_CONTEXT="${2:-kind-${KIND_CLUSTER}}"
KCTL="kubectl --context=${KUBE_CONTEXT}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_CONTAINER="${KIND_CLUSTER}-control-plane"

log() { echo "==> $*"; }

# kind load / piped ctr import are flaky; save to a file under the repo (snap docker can't write /tmp).
load_image() {
  local workdir
  workdir="$(mktemp -d "${REPO_ROOT}/.image-staging.XXXXXX")"
  trap 'rm -rf "${workdir}"' RETURN
  docker save "$1" -o "${workdir}/img.tar"
  docker cp "${workdir}/img.tar" "${NODE_CONTAINER}:/img.tar"
  docker exec "${NODE_CONTAINER}" ctr -n k8s.io images import /img.tar >/dev/null 2>&1 || true
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
  [fhir-sync]="${REPO_ROOT}/scripts/sync"
  [ehr-fhir-server]="https://github.com/wso2/fhir-server.git#v0.5.0"
  [care-loop-fhir-server]="https://github.com/wso2/fhir-server.git#v0.5.0"
  [fhir-mcp-server]="https://github.com/wso2/fhir-mcp-server.git#0.10.0"
)

for svc in "${!BUILD_CONTEXTS[@]}"; do
  log "Building and loading ${svc}:openchoreo"
  docker build -q -t "${svc}:openchoreo" "${BUILD_CONTEXTS[$svc]}" >/dev/null
  load_image "${svc}:openchoreo"
done

# Public images: no build needed, but must still be pre-loaded into containerd.
for image in postgres:16-alpine; do
  log "Loading public image ${image}"
  docker pull -q --platform linux/amd64 "${image}" >/dev/null
  load_image "${image}"
done

# Push each local gitignored Config.toml (the same files docker-compose mounts) into OpenBao; the Workloads resolve them via SecretReference.
for svc in care-loop-ai-service care-loop-collector-service care-loop-analysis-service; do
  cfg="${REPO_ROOT}/${svc}/Config.toml"
  if [ ! -f "${cfg}" ]; then
    log "ERROR: ${cfg} not found - it is gitignored and required (docker-compose mounts the same file)"
    exit 1
  fi
  log "Storing ${svc}/Config.toml in OpenBao and creating its SecretReference"
  ${KCTL} exec -i -n openbao openbao-0 -- sh -c \
    'cat > /tmp/cfg && bao kv put "secret/'"${svc}"'-config" Config.toml="$(cat /tmp/cfg)" >/dev/null && rm /tmp/cfg' < "${cfg}"
  ${KCTL} apply -f - <<EOF
apiVersion: openchoreo.dev/v1alpha1
kind: SecretReference
metadata:
  name: ${svc}-config
  namespace: default
spec:
  data:
    - secretKey: Config.toml
      remoteRef:
        key: ${svc}-config
        property: Config.toml
  template:
    type: Opaque
EOF
done

log "Applying Component/Workload manifests"
for f in \
  "${REPO_ROOT}/ehr-fhir-server-db/.openchoreo/component.yaml" \
  "${REPO_ROOT}/apple-healthkit-simulator/component.yaml" \
  "${REPO_ROOT}/care-loop-heart-risk-service/component.yaml" \
  "${REPO_ROOT}/whatsapp-simulator/component.yaml" \
  "${REPO_ROOT}/ehr-fhir-server/component.yaml" \
  "${REPO_ROOT}/care-loop-fhir-server/.openchoreo/component.yaml" \
  "${REPO_ROOT}/fhir-mcp-server/.openchoreo/component.yaml" \
  "${REPO_ROOT}/front-desk-dashboard/.openchoreo/component.yaml" \
  "${REPO_ROOT}/care-loop-ai-service/.openchoreo/component.yaml" \
  "${REPO_ROOT}/care-loop-collector-service/.openchoreo/component.yaml" \
  "${REPO_ROOT}/care-loop-analysis-service/.openchoreo/component.yaml" \
  "${REPO_ROOT}/scripts/sync/.openchoreo/component.yaml"; do
  # Retried once: the autoDeploy controller can create a ReleaseBinding between the Component
  # apply and the RB create in the same file (AlreadyExists race on fresh clusters).
  ${KCTL} apply -f "${f}" || { sleep 5; ${KCTL} apply -f "${f}"; }
done

log "Done. Check pod status with: kubectl get pods -A --context=${KUBE_CONTEXT}"
