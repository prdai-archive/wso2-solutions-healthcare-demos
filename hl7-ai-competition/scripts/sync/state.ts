const STATE_FILE = process.env.SYNC_STATE_FILE ?? "/data/state.json";

export async function loadWatermark(): Promise<string> {
  const file = Bun.file(STATE_FILE);
  return (await file.exists()) ? ((await file.json()) as { since: string }).since : "1970-01-01";
}

export async function saveWatermark(since: string): Promise<void> {
  await Bun.write(STATE_FILE, JSON.stringify({ since }));
}
