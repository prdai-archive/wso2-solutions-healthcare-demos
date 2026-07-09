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
  [ehr-fhir-server]="https://github.com/wso2/fhir-server.git#v0.5.0"
  [fhir-mcp-server]="https://github.com/wso2/fhir-mcp-server.git#0.10.0"
)

for svc in "${!BUILD_CONTEXTS[@]}"; do
  log "Building and loading ${svc}:openchoreo"
  docker build -q -t "${svc}:openchoreo" "${BUILD_CONTEXTS[$svc]}" >/dev/null
  load_image "${svc}:openchoreo"
done

# Public images: no build needed, but must still be pre-loaded into containerd.
for image in postgres:16-alpine hapiproject/hapi:v8.10.0-2; do
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

# The ComponentType's 256Mi default OOM-kills the JVM services; Component.spec.parameters doesn't reach the Deployment in v1.1, so patch the ReleaseBindings (what the renderer actually reads).
log "Raising memory for JVM-based components"
patch_resources() {
  ${KCTL} wait --for=create "releasebinding/$1" -n default --timeout=120s >/dev/null
  ${KCTL} patch releasebinding "$1" -n default --type=merge \
    -p "{\"spec\":{\"componentTypeEnvironmentConfigs\":{\"resources\":{\"requests\":$2,\"limits\":$3}}}}"
}
patch_resources care-loop-fhir-server-development '{"cpu":"250m","memory":"1024Mi"}' '{"cpu":"1","memory":"1536Mi"}'
for rb in ehr-fhir-server-development care-loop-ai-service-development \
  care-loop-collector-service-development care-loop-analysis-service-development; do
  patch_resources "${rb}" '{"cpu":"100m","memory":"512Mi"}' '{"cpu":"1","memory":"768Mi"}'
done

log "Done. Check pod status with: kubectl get pods -A --context=${KUBE_CONTEXT}"
