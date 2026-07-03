import { loadWatermark, saveWatermark } from "./state";
import { log } from "./util";
import { SYNC_RESOURCE_TYPES } from "./types";
import type { FhirBundle, FhirResource } from "./types";

export const EHR_FHIR_SERVER_URL = process.env.EHR_FHIR_SERVER_URL ?? "http://localhost:9090/fhir/r4";
export const CARE_LOOP_FHIR_SERVER_URL = process.env.CARE_LOOP_FHIR_SERVER_URL ?? "http://localhost:9091/fhir";
const EHR_BASE_PATH = new URL(EHR_FHIR_SERVER_URL).pathname;

const WATERMARK_SAFETY_BUFFER_MS = 5 * 60 * 1000;

function bufferedNow(): string {
  return new Date(Date.now() - WATERMARK_SAFETY_BUFFER_MS).toISOString().split(".")[0] + "Z";
}

async function getFhirBundle(path: string): Promise<FhirBundle> {
  const res = await fetch(`${EHR_FHIR_SERVER_URL}${path}`, { headers: { accept: "application/fhir+json" } });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as FhirBundle;
}

function nextPagePath(bundle: FhirBundle): string | null {
  const nextUrl = bundle.link?.find((l) => l.relation === "next")?.url;
  if (!nextUrl) {
    return null;
  }
  const url = new URL(nextUrl);
  return url.pathname.slice(EHR_BASE_PATH.length) + url.search;
}

async function fetchChangedSince(resourceType: string, since: string): Promise<FhirResource[]> {
  const resources: FhirResource[] = [];
  let path: string | null = `/${resourceType}?_lastUpdated=gt${since}&_sort=_lastUpdated&_count=100`;
  while (path) {
    const bundle = await getFhirBundle(path);
    resources.push(...(bundle.entry ?? []).map((entry) => entry.resource));
    path = nextPagePath(bundle);
  }
  return resources;
}

async function putResource(resourceType: string, resource: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${CARE_LOOP_FHIR_SERVER_URL}/${resourceType}/${resource.id}`, {
    method: "PUT",
    headers: { "content-type": "application/fhir+json" },
    body: JSON.stringify(resource),
  });
  if (!res.ok) {
    throw new Error(`PUT ${resourceType}/${resource.id} failed: ${res.status} ${await res.text()}`);
  }
}

export async function syncAll(): Promise<void> {
  const since = await loadWatermark();
  const nextWatermark = bufferedNow();

  for (const resourceType of SYNC_RESOURCE_TYPES) {
    const changed = await fetchChangedSince(resourceType, since);
    log(`${resourceType}: ${changed.length} resource(s) changed since ${since}`);
    for (const resource of changed) {
      await putResource(resourceType, resource);
      log(`synced ${resourceType}/${resource.id}`);
    }
  }

  await saveWatermark(nextWatermark);
}
