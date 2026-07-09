#!/usr/bin/env bash
# Builds each service image, loads it into the kind cluster's containerd (no registry), applies its Component+Workload. Run after install.sh.
set -euo pipefail

KIND_CLUSTER="${1:?usage: deploy-components.sh <kind-cluster-name> [kube-context]}"
KUBE_CONTEXT="${2:-kind-${KIND_CLUSTER}}"
KCTL="kubectl --context=${KUBE_CONTEXT}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_CONTAINER="${KIND_CLUSTER}-control-plane"

log() { echo "==> $*"; }

# `kind load docker-image` is flaky under sandboxed docker, and snap docker can't write /tmp - so save-and-import, staged under the repo.
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

# Public images: no build needed, but must still be pre-loaded into containerd.
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

# The ComponentType's 256Mi default OOM-kills the JVM services; Component.spec.parameters doesn't reach the Deployment in v1.1, so patch the ReleaseBindings (what the renderer actually reads).
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

DP_NS="$(${KCTL} get ns -o name | grep '^namespace/dp-' | head -1 | cut -d/ -f2)"
mount_local_config() {
  local svc="$1" cfg="${REPO_ROOT}/$1/Config.toml" deploy vol
  if [ ! -f "${cfg}" ]; then
    log "No local ${svc}/Config.toml; keeping the values inlined in its component.yaml"
    return 0
  fi
  log "Mounting local ${svc}/Config.toml via Secret"
  deploy="$(${KCTL} get deploy -n "${DP_NS}" -o name | grep "${svc}-" | cut -d/ -f2)"
  vol="$(${KCTL} get deploy "${deploy}" -n "${DP_NS}" -o jsonpath='{.spec.template.spec.volumes[0].name}')"
  ${KCTL} create secret generic "${svc}-realconfig" -n "${DP_NS}" \
    --from-file=Config.toml="${cfg}" --dry-run=client -o yaml | ${KCTL} apply -f -
  ${KCTL} patch deployment/"${deploy}" -n "${DP_NS}" --type=json \
    -p="[{\"op\":\"replace\",\"path\":\"/spec/template/spec/volumes/0\",\"value\":{\"name\":\"${vol}\",\"secret\":{\"secretName\":\"${svc}-realconfig\"}}}]"
}
for svc in care-loop-ai-service care-loop-collector-service care-loop-analysis-service; do
  mount_local_config "${svc}"
done
if [ ! -f "${REPO_ROOT}/care-loop-ai-service/Config.toml" ]; then
  log "care-loop-ai-service still needs a real openAiApiKey out-of-band (never commit it) - see openchoreo/README.md"
fi
log "Done. Check pod status with: kubectl get pods -A --context=${KUBE_CONTEXT}"
