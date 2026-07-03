export type SyncState = Record<string, string>; // resourceType -> watermark ("_lastUpdated" of the newest synced resource)

const STATE_FILE = process.env.SYNC_STATE_FILE ?? "/data/state.json";
const EPOCH = "1970-01-01";

export async function loadState(): Promise<SyncState> {
  const file = Bun.file(STATE_FILE);
  return (await file.exists()) ? ((await file.json()) as SyncState) : {};
}

export async function saveState(state: SyncState): Promise<void> {
  await Bun.write(STATE_FILE, JSON.stringify(state, null, 2));
}

export function watermark(state: SyncState, resourceType: string): string {
  return state[resourceType] ?? EPOCH;
}
