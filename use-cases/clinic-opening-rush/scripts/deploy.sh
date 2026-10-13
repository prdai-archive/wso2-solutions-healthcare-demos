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

schema_present() {
  kubectl -n "${NAMESPACE}" exec postgres-0 -- \
    psql -U fhir -d fhirdb -tAc "SELECT to_regclass('public.resources')" 2>/dev/null | grep -q resources
}

kubectl apply -f "${ROOT}/k8s/namespace.yaml"

kubectl apply -f "${ROOT}/k8s/postgres.yaml"
kubectl -n "${NAMESPACE}" rollout status statefulset/postgres --timeout=300s

kubectl apply -f "${ROOT}/k8s/fhir.yaml"

# Steady-state pods run with FHIR_CREATE_TABLES=false so scaling never takes table
# locks against live searches. Create the schema once with a single bootstrap pod.
if ! schema_present; then
  echo "bootstrapping FHIR schema with a single pod"
  kubectl -n "${NAMESPACE}" set env deployment/fhir-server FHIR_CREATE_TABLES=true
  kubectl -n "${NAMESPACE}" scale deployment/fhir-server --replicas=1
  kubectl -n "${NAMESPACE}" rollout status deployment/fhir-server --timeout=300s
  kubectl apply -f "${ROOT}/k8s/fhir.yaml"
fi

kubectl -n "${NAMESPACE}" rollout status deployment/fhir-server --timeout=300s

kubectl apply -f "${ROOT}/k8s/hpa.yaml"
