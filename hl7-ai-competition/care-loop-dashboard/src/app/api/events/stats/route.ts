import { NextResponse } from "next/server";

import { getEventStats } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getEventStats());
}
