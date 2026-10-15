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

NAMESPACE="${NAMESPACE:-clinic-rush}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

helm repo add prometheus-community https://prometheus-community.github.io/helm-charts >/dev/null 2>&1 || true
helm repo add grafana https://grafana.github.io/helm-charts >/dev/null 2>&1 || true
helm repo update >/dev/null

helm upgrade --install prometheus prometheus-community/prometheus \
  --namespace "${NAMESPACE}" --create-namespace \
  --version 29.36.1 \
  --values "${ROOT}/monitoring/prometheus-values.yaml" \
  --wait --timeout 5m

helm upgrade --install prometheus-adapter prometheus-community/prometheus-adapter \
  --namespace "${NAMESPACE}" \
  --version 5.3.0 \
  --values "${ROOT}/monitoring/prometheus-adapter-values.yaml" \
  --wait --timeout 5m

helm upgrade --install grafana grafana/grafana \
  --namespace "${NAMESPACE}" \
  --version 10.5.15 \
  --values "${ROOT}/monitoring/grafana-values.yaml" \
  --wait --timeout 5m

kubectl apply -f "${ROOT}/monitoring/grafana-datasource.yaml"

kubectl -n "${NAMESPACE}" create configmap grafana-dashboard-clinic-rush \
  --from-file=clinic-rush.json="${ROOT}/monitoring/dashboards/clinic-rush.json" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "${NAMESPACE}" label configmap grafana-dashboard-clinic-rush grafana_dashboard=1 --overwrite
