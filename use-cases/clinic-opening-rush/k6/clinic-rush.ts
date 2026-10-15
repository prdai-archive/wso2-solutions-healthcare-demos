//
// Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).
//
// WSO2 LLC. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied. See the License for the
// specific language governing permissions and limitations
// under the License.
//

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.FHIR_BASE_URL || 'http://localhost:9090/fhir/r4';
const VUS = Number(__ENV.VUS || 50);
const DURATION = __ENV.DURATION || '10m';
const THINK_TIME = Number(__ENV.THINK_TIME || 0.1);
const SEARCH_RATIO = Number(__ENV.SEARCH_RATIO || 0.8);
const MAX_PATIENTS = Number(__ENV.MAX_PATIENTS || 1000);
const NAMESPACE = __ENV.K6_NAMESPACE || 'clinic-rush';

const CATEGORIES = ['laboratory', 'vital-signs'];

const searchCount = new Counter('clinic_rush_search');
const updateCount = new Counter('clinic_rush_update');

export const options = {
  tags: {
    namespace: NAMESPACE,
  },
  vus: VUS,
  duration: DURATION,
};

interface SetupData {
  patientIds: string[];
}

interface FhirBundle {
  entry?: Array<{ resource?: Record<string, any> }>;
  link?: Array<{ relation: string; url: string }>;
}

function nextLink(bundle: FhirBundle): string | undefined {
  return (bundle.link || []).find((l) => l.relation === 'next')?.url;
}

export function setup(): SetupData {
  const patientIds: string[] = [];
  let url: string | undefined = `${BASE_URL}/Patient?_count=500`;
  while (url && patientIds.length < MAX_PATIENTS) {
    const res = http.get(url);
    if (res.status !== 200) {
      break;
    }
    const bundle = JSON.parse(res.body as string) as FhirBundle;
    for (const entry of bundle.entry || []) {
      if (entry.resource && entry.resource.id) {
        patientIds.push(entry.resource.id as string);
      }
    }
    url = nextLink(bundle);
  }
  if (patientIds.length === 0) {
    throw new Error(`no patients found at ${BASE_URL}; run "make seed" first`);
  }
  return { patientIds };
}

export default function (data: SetupData): void {
  const pid = data.patientIds[Math.floor(Math.random() * data.patientIds.length)];
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  if (Math.random() < SEARCH_RATIO) {
    searchObservations(pid, category);
  } else {
    updateObservation(pid, category);
  }
  sleep(THINK_TIME);
}

function searchObservations(pid: string, category: string): void {
  const res = http.get(`${BASE_URL}/Observation?patient=${pid}&category=${category}&_count=20`, {
    tags: { name: 'search' },
  });
  searchCount.add(1);
  check(res, { 'search is 200': (r) => r.status === 200 });
}

function updateObservation(pid: string, category: string): void {
  const res = http.get(`${BASE_URL}/Observation?patient=${pid}&category=${category}&_count=50`, {
    tags: { name: 'search' },
  });
  if (res.status !== 200) {
    check(res, { 'update search is 200': (r) => r.status === 200 });
    return;
  }
  const bundle = JSON.parse(res.body as string) as FhirBundle;
  const valued = (bundle.entry || [])
    .map((e) => e.resource)
    .filter(
      (r): r is Record<string, any> =>
        !!r && !!r.valueQuantity && typeof r.valueQuantity.value === 'number',
    );
  if (valued.length === 0) {
    return;
  }
  const resource = valued[Math.floor(Math.random() * valued.length)];
  resource.valueQuantity.value = Number((resource.valueQuantity.value * (0.9 + Math.random() * 0.2)).toFixed(2));
  const put = http.put(`${BASE_URL}/Observation/${resource.id}`, JSON.stringify(resource), {
    headers: { 'Content-Type': 'application/fhir+json' },
    tags: { name: 'write' },
  });
  updateCount.add(1);
  check(put, { 'update is 200': (r) => r.status === 200 });
}
