#!/usr/bin/env bash
#
# Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).
#
# WSO2 LLC. licenses this file to you under the Apache License,
# Version 2.0 (the "License"); you may not use this file except
# in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-clinic-rush}"
K3S_IMAGE="${K3S_IMAGE:-rancher/k3s:v1.35.5-k3s1}"
FHIR_HOST_PORT="${FHIR_HOST_PORT:-9090}"
GRAFANA_HOST_PORT="${GRAFANA_HOST_PORT:-3000}"
PROMETHEUS_HOST_PORT="${PROMETHEUS_HOST_PORT:-9091}"

if k3d cluster list --no-headers 2>/dev/null | awk '{print $1}' | grep -qx "${CLUSTER_NAME}"; then
  echo "cluster '${CLUSTER_NAME}' already exists"
  exit 0
fi

k3d cluster create "${CLUSTER_NAME}" \
  --servers 1 \
  --agents 0 \
  --image "${K3S_IMAGE}" \
  --k3s-arg "--disable=traefik@server:0" \
  --port "${FHIR_HOST_PORT}:30090@server:0" \
  --port "${GRAFANA_HOST_PORT}:30030@server:0" \
  --port "${PROMETHEUS_HOST_PORT}:30091@server:0" \
  --wait

echo "cluster '${CLUSTER_NAME}' is up"
echo "  FHIR       http://localhost:${FHIR_HOST_PORT}/fhir/r4"
echo "  Grafana    http://localhost:${GRAFANA_HOST_PORT}"
echo "  Prometheus http://localhost:${PROMETHEUS_HOST_PORT}"
