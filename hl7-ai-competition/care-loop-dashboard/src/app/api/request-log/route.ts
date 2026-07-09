import { NextResponse } from "next/server";

import { listRequestLog } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ entries: listRequestLog(50) });
}
