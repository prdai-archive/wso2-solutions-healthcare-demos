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
#
# Loads the Synthea Sep-2019 R4 sample (1,180 patient Bundles, ~1.3 GB) into the
# FHIR server. Each bundle is rewritten transaction->batch and every create is
# turned into a PUT keyed by the resource id, because bundles reuse organisations
# and practitioners and plain POSTs collide across bundles. Idempotent PUTs make
# the seed re-runnable.
#
# Env: DATA_URL, FHIR_URL, CACHE_DIR, LIMIT (seed only first N bundles), PARALLEL.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_URL="${DATA_URL:-https://synthetichealth.github.io/synthea-sample-data/downloads/synthea_sample_data_fhir_r4_sep2019.zip}"
FHIR_URL="${FHIR_URL:-http://localhost:9090/fhir/r4}"
CACHE_DIR="${CACHE_DIR:-${ROOT}/k6/.synthea}"
LIMIT="${LIMIT:-0}"
PARALLEL="${PARALLEL:-4}"
RETRIES="${RETRIES:-3}"

for bin in curl unzip jq; do
  command -v "${bin}" >/dev/null || { echo "missing required tool: ${bin}" >&2; exit 2; }
done

HEALTH_URL="${FHIR_URL%/fhir/r4}/health/ready"
ZIP="${CACHE_DIR}/synthea.zip"
DATA_DIR="${CACHE_DIR}/fhir"

mkdir -p "${CACHE_DIR}"

if [ ! -f "${ZIP}" ]; then
  echo "downloading ${DATA_URL}"
  curl -fSL --retry 3 -o "${ZIP}" "${DATA_URL}"
fi

if [ ! -d "${DATA_DIR}" ]; then
  echo "extracting patient bundles"
  unzip -oq "${ZIP}" 'fhir/*.json' -d "${CACHE_DIR}"
fi

printf 'waiting for FHIR server at %s ' "${HEALTH_URL}"
until curl -sf -o /dev/null --max-time 15 "${HEALTH_URL}"; do
  printf '.'
  sleep 2
done
echo "ready"

mapfile -t files < <(find "${DATA_DIR}" -name '*.json' | sort)
if [ "${LIMIT}" -gt 0 ]; then
  files=("${files[@]:0:${LIMIT}}")
fi
total="${#files[@]}"
echo "seeding ${total} patient bundles (parallel ${PARALLEL})"

RESULTS="$(mktemp -d)"
trap 'rm -rf "${RESULTS}"' EXIT

post_bundle() {
  local bundle="$1" name tmp resp code attempt bad
  name="$(basename "${bundle}")"
  tmp="$(mktemp)"
  resp="$(mktemp)"
  jq '(reduce .entry[] as $e ({}; .[$e.fullUrl] = ($e.resource.resourceType + "/" + $e.resource.id))) as $m
      | .type = "batch"
      | .entry |= map(
          if (.request.method? == "POST") and (.resource.id? != null)
          then .request.method = "PUT" | .request.url = (.resource.resourceType + "/" + .resource.id)
          else . end)
      | walk(if type == "object" and (.reference? | type == "string") and ($m[.reference] != null)
             then .reference = $m[.reference] else . end)' "${bundle}" >"${tmp}"
  code="000"
  attempt=0
  while [ "${attempt}" -lt "${RETRIES}" ]; do
    attempt=$((attempt + 1))
    if code="$(curl -sS -o "${resp}" -w '%{http_code}' -X POST \
      -H 'Content-Type: application/fhir+json' -H 'Expect:' \
      --max-time 900 --data-binary "@${tmp}" "${FHIR_URL}")"; then
      break
    fi
    code="000"
    sleep $((attempt * 5))
  done
  rm -f "${tmp}"
  bad=0
  if [ "${code}" = "200" ]; then
    bad="$(jq '[.entry[]?.response.status | select(startswith("4") or startswith("5"))] | length' "${resp}" 2>/dev/null || echo 0)"
  fi
  rm -f "${resp}"
  echo "${name} http=${code} failed_entries=${bad}" >"${RESULTS}/${name}.result"
}
export -f post_bundle
export FHIR_URL RESULTS RETRIES

printf '%s\0' "${files[@]}" | xargs -0 -P "${PARALLEL}" -I{} bash -c 'post_bundle "$1"' _ {}

failed=0
for result in "${RESULTS}"/*.result; do
  line="$(cat "${result}")"
  case "${line}" in
    *"http=200 failed_entries=0") ;;
    *) failed=$((failed + 1)); echo "${line}" ;;
  esac
done

patients="$(curl -fsS "${FHIR_URL}/Patient?_summary=count" 2>/dev/null | jq -r '.total // 0' 2>/dev/null || echo 0)"
echo "server Patient count: ${patients} (expected at least ${total})"
if [ "${patients}" -lt "${total}" ]; then
  echo "seed incomplete: ${patients} patients for ${total} bundles" >&2
  failed=$((failed + 1))
fi

echo "seeded $((total - failed))/${total} bundles (${failed} failed)"
[ "${failed}" -eq 0 ]
