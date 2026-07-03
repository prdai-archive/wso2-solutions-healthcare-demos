import { loadState, mappedId, recordSync, saveState, watermark } from "./state";
import { log } from "./util";
import { REFERENCE_FIELDS, SYNC_ORDER } from "./types";
import type { FhirBundle, FhirResource } from "./types";
import type { SyncState } from "./state";

export const EHR_FHIR_SERVER_URL = process.env.EHR_FHIR_SERVER_URL ?? "http://localhost:9090/fhir/r4";
export const CARE_LOOP_FHIR_SERVER_URL = process.env.CARE_LOOP_FHIR_SERVER_URL ?? "http://localhost:9091/fhir";

async function fhirGet(baseUrl: string, path: string): Promise<FhirBundle> {
  const res = await fetch(`${baseUrl}${path}`, { headers: { accept: "application/fhir+json" } });
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as FhirBundle;
}

async function fhirCreate(baseUrl: string, resourceType: string, resource: Record<string, unknown>): Promise<FhirResource> {
  const res = await fetch(`${baseUrl}/${resourceType}`, {
    method: "POST",
    headers: { "content-type": "application/fhir+json" },
    body: JSON.stringify(resource),
  });
  if (!res.ok) {
    throw new Error(`POST ${resourceType} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as FhirResource;
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

function remapReferences(state: SyncState, resourceType: string, copy: Record<string, unknown>): boolean {
  for (const [field, refType] of Object.entries(REFERENCE_FIELDS[resourceType] ?? {})) {
    const ref = (copy[field] as { reference?: string } | undefined)?.reference;
    if (!ref) {
      continue;
    }
    const ehrId = ref.split("/").pop();
    const internalId = ehrId && mappedId(state, refType, ehrId);
    if (!internalId) {
      return false;
    }
    copy[field] = { reference: `${refType}/${internalId}` };
  }
  return true;
}

async function syncResourceType(state: SyncState, resourceType: string): Promise<void> {
  const since = watermark(state, resourceType);
  const diff = await fetchDiff(resourceType, since);
  log(`${resourceType}: ${diff.length} resource(s) changed since ${since}`);

  for (const resource of diff) {
    const { id: ehrId, meta, ...rest } = resource;

    // ehr-fhir-server's _lastUpdated "gt" filter is inclusive of the exact same
    // second (confirmed: gt<timestamp> still matches a resource with that exact
    // lastUpdated), so a resource can reappear in the very next diff. The id map
    // makes re-syncing it a no-op instead of a duplicate.
    if (mappedId(state, resourceType, ehrId)) {
      continue;
    }

    const copy: Record<string, unknown> = { ...rest, resourceType };

    if (!remapReferences(state, resourceType, copy)) {
      log(`skipping ${resourceType}/${ehrId}: a referenced resource is not yet synced`);
      continue;
    }

    const created = await fhirCreate(CARE_LOOP_FHIR_SERVER_URL, resourceType, copy);
    recordSync(state, resourceType, ehrId, created.id, meta?.lastUpdated ?? since);
    log(`synced ${resourceType}/${ehrId} -> care-loop-fhir-server ${resourceType}/${created.id}`);
  }
}

export async function syncAll(): Promise<void> {
  const state = await loadState();
  for (const resourceType of SYNC_ORDER) {
    await syncResourceType(state, resourceType);
    await saveState(state);
  }
}
