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
import { check } from 'k6';
import { Counter } from 'k6/metrics';
import exec from 'k6/execution';

const BASE_URL = __ENV.FHIR_BASE_URL || 'http://localhost:9090/fhir/r4';
const BASELINE_RPS = Number(__ENV.BASELINE_RPS || 20);
const PEAK_RPS = Number(__ENV.PEAK_RPS || 200);
const PATIENTS = Number(__ENV.PATIENTS || 20);
const NAMESPACE = __ENV.K6_NAMESPACE || 'clinic-rush';

const searchCount = new Counter('clinic_rush_search');
const bundleCount = new Counter('clinic_rush_bundle');

const QUICK = __ENV.QUICK === '1';

const FULL_STAGES = [
  { target: BASELINE_RPS, duration: '30s' },
  { target: PEAK_RPS, duration: '3m' },
  { target: PEAK_RPS, duration: '2m' },
  { target: BASELINE_RPS, duration: '1m' },
  { target: BASELINE_RPS, duration: '30s' },
];

const QUICK_STAGES = [
  { target: BASELINE_RPS, duration: '10s' },
  { target: PEAK_RPS, duration: '20s' },
  { target: BASELINE_RPS, duration: '10s' },
];

export const options = {
  tags: {
    namespace: NAMESPACE,
  },
  scenarios: {
    clinic_rush: {
      executor: 'ramping-arrival-rate',
      exec: 'rush',
      startRate: BASELINE_RPS,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 400,
      stages: QUICK ? QUICK_STAGES : FULL_STAGES,
    },
  },
};

const FHIR_HEADERS = { headers: { 'Content-Type': 'application/fhir+json' } };

function uuid4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function setup() {
  const patientIds = [];
  for (let i = 0; i < PATIENTS; i++) {
    const patient = {
      resourceType: 'Patient',
      name: [{ family: `Rush${i}`, given: ['Clinic'] }],
    };
    const res = http.post(`${BASE_URL}/Patient`, JSON.stringify(patient), FHIR_HEADERS);
    if (res.status === 201 || res.status === 200) {
      patientIds.push(JSON.parse(res.body).id);
    }
  }
  for (const id of patientIds) {
    const observation = {
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
            },
          ],
        },
      ],
      code: { coding: [{ system: 'http://loinc.org', code: '718-7', display: 'Hemoglobin' }] },
      subject: { reference: `Patient/${id}` },
      valueQuantity: { value: 13.5, unit: 'g/dL' },
    };
    http.post(`${BASE_URL}/Observation`, JSON.stringify(observation), FHIR_HEADERS);
  }
  return { patientIds };
}

export function rush(data) {
  const ids = data.patientIds;
  const pid = ids[Math.floor(Math.random() * ids.length)];
  if (Math.random() < 0.2) {
    writeBundle(pid);
    return;
  }
  if (Math.random() < 0.5) {
    searchObservations(pid);
    return;
  }
  searchEncounters();
}

function searchObservations(pid) {
  const res = http.get(`${BASE_URL}/Observation?patient=${pid}&category=laboratory`, {
    tags: { name: 'search' },
  });
  searchCount.add(1);
  check(res, { 'observation search is 200': (r) => r.status === 200 });
}

function searchEncounters() {
  const res = http.get(`${BASE_URL}/Encounter?class=AMB`, { tags: { name: 'search' } });
  searchCount.add(1);
  check(res, { 'encounter search is 200': (r) => r.status === 200 });
}

function writeBundle(pid) {
  const encounterRef = `urn:uuid:${uuid4()}`;
  const bundle = {
    resourceType: 'Bundle',
    type: 'transaction',
    entry: [
      {
        fullUrl: encounterRef,
        resource: {
          resourceType: 'Encounter',
          status: 'finished',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
          },
          subject: { reference: `Patient/${pid}` },
        },
        request: { method: 'POST', url: 'Encounter' },
      },
      {
        resource: {
          resourceType: 'Observation',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'laboratory',
                },
              ],
            },
          ],
          code: { coding: [{ system: 'http://loinc.org', code: '718-7', display: 'Hemoglobin' }] },
          subject: { reference: `Patient/${pid}` },
          encounter: { reference: encounterRef },
          valueQuantity: { value: 13.5, unit: 'g/dL' },
        },
        request: { method: 'POST', url: 'Observation' },
      },
    ],
  };
  const res = http.post(`${BASE_URL}`, JSON.stringify(bundle), {
    headers: { 'Content-Type': 'application/fhir+json' },
    tags: { name: 'write' },
  });
  bundleCount.add(1);
  check(res, { 'transaction bundle is 200': (r) => r.status === 200 });
}
