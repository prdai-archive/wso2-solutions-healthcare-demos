export type SyncState = {
  watermarks: Record<string, string>;
  idMap: Record<string, string>;
};

const STATE_FILE = process.env.SYNC_STATE_FILE ?? "/data/state.json";
const EPOCH = "1970-01-01";

export async function loadState(): Promise<SyncState> {
  const file = Bun.file(STATE_FILE);
  if (!(await file.exists())) {
    return { watermarks: {}, idMap: {} };
  }
  return (await file.json()) as SyncState;
}

export async function saveState(state: SyncState): Promise<void> {
  await Bun.write(STATE_FILE, JSON.stringify(state, null, 2));
}

export function watermark(state: SyncState, resourceType: string): string {
  return state.watermarks[resourceType] ?? EPOCH;
}

export function mappedId(state: SyncState, resourceType: string, ehrId: string): string | undefined {
  return state.idMap[`${resourceType}:${ehrId}`];
}

export function recordSync(state: SyncState, resourceType: string, ehrId: string, internalId: string, ehrLastUpdated: string): void {
  state.idMap[`${resourceType}:${ehrId}`] = internalId;
  if (ehrLastUpdated > watermark(state, resourceType)) {
    state.watermarks[resourceType] = ehrLastUpdated;
  }
}
