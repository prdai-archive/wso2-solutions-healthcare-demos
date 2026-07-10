import { NextResponse } from "next/server";

import { listRecentEvents } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ events: listRecentEvents() });
}
