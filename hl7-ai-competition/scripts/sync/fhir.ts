import { loadWatermark, saveWatermark } from "./state";
import { log } from "./util";
import { SYNC_RESOURCE_TYPES } from "./types";
import type { FhirBundle, FhirResource } from "./types";

export const EHR_FHIR_SERVER_URL = process.env.EHR_FHIR_SERVER_URL ?? "http://localhost:9090/fhir/r4";
export const CARE_LOOP_FHIR_SERVER_URL = process.env.CARE_LOOP_FHIR_SERVER_URL ?? "http://localhost:9091/fhir";

// Overlap this far into the past on every run, rather than trusting the EHR's
// exact clock: PUT is idempotent, so re-syncing something we already have is
// free, while missing something because of clock skew is not.
const WATERMARK_SAFETY_BUFFER_MS = 5 * 60 * 1000;

async function fhirGet(baseUrl: string, path: string): Promise<FhirBundle> {
  const res = await fetch(`${baseUrl}${path}`, { headers: { accept: "application/fhir+json" } });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as FhirBundle;
}

// PUT-by-id, not POST: the internal store keeps the EHR's own resource id, so
// references (Encounter.subject, Observation.encounter, ...) already point to
// the right id on both sides - no id mapping or reference rewriting needed.
// It also makes re-syncing a resource a harmless no-op update, not a duplicate.
async function fhirPut(resourceType: string, resource: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${CARE_LOOP_FHIR_SERVER_URL}/${resourceType}/${resource.id}`, {
    method: "PUT",
    headers: { "content-type": "application/fhir+json" },
    body: JSON.stringify(resource),
  });
  if (!res.ok) {
    throw new Error(`PUT ${resourceType}/${resource.id} failed: ${res.status} ${await res.text()}`);
  }
}

// The server's pagination "next" links are built from its own configured BASE_URL,
// which differs from EHR_FHIR_SERVER_URL (the docker-network address we call it on),
// so we can't string-prefix-strip the link - reconstruct the path/query instead.
const EHR_BASE_PATH = new URL(EHR_FHIR_SERVER_URL).pathname;

async function fetchDiff(resourceType: string, since: string): Promise<FhirResource[]> {
  const resources: FhirResource[] = [];
  let path: string | null = `/${resourceType}?_lastUpdated=gt${since}&_sort=_lastUpdated&_count=100`;
  while (path) {
    const bundle: FhirBundle = await fhirGet(EHR_FHIR_SERVER_URL, path);
    resources.push(...(bundle.entry ?? []).map((e) => e.resource));
    const next = bundle.link?.find((l) => l.relation === "next")?.url;
    path = next ? new URL(next).pathname.slice(EHR_BASE_PATH.length) + new URL(next).search : null;
  }
  return resources;
}

export async function syncAll(): Promise<void> {
  const since = await loadWatermark();
  const runStartedAt = new Date(Date.now() - WATERMARK_SAFETY_BUFFER_MS).toISOString().split(".")[0] + "Z";

  for (const resourceType of SYNC_RESOURCE_TYPES) {
    const diff = await fetchDiff(resourceType, since);
    log(`${resourceType}: ${diff.length} resource(s) changed since ${since}`);
    for (const resource of diff) {
      await fhirPut(resourceType, resource);
      log(`synced ${resourceType}/${resource.id}`);
    }
  }

  await saveWatermark(runStartedAt);
}
