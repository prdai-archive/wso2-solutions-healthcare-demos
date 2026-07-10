import { NextResponse } from "next/server";

import { insertEvent } from "@/lib/db";

export const runtime = "nodejs";

interface CreateEventBody {
  patientId?: unknown;
  label?: unknown;
  detail?: unknown;
  payload?: unknown;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value).every((v) => typeof v === "string");
}

// Fixed contract other services POST to: {patientId, label, detail?, payload?}.
// payload is an optional flat object of string -> string, whatever real fields
// the caller already has in scope (e.g. {"probability":"0.64"}) - never invented.
// Fire-and-forget, no auth (internal network) — insert and return fast.
export async function POST(request: Request) {
  let body: CreateEventBody;
  try {
    body = (await request.json()) as CreateEventBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { patientId, label, detail, payload } = body;

  if (typeof patientId !== "string" || patientId.trim() === "") {
    return NextResponse.json(
      { error: "patientId must be a non-empty string" },
      { status: 400 },
    );
  }
  if (typeof label !== "string" || label.trim() === "") {
    return NextResponse.json(
      { error: "label must be a non-empty string" },
      { status: 400 },
    );
  }
  if (detail !== undefined && typeof detail !== "string") {
    return NextResponse.json(
      { error: "detail must be a string when present" },
      { status: 400 },
    );
  }
  if (payload !== undefined && !isStringRecord(payload)) {
    return NextResponse.json(
      { error: "payload must be a flat object of strings when present" },
      { status: 400 },
    );
  }

  insertEvent(patientId, label, detail, payload as Record<string, string> | undefined);
  return NextResponse.json({ ok: true }, { status: 202 });
}
