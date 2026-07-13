import type { Bundle, Task } from "fhir/r4";

import process from "node:process";

import { Client } from "fhir-kit-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export interface TaskSummary {
  id: string;
  description: string | null;
  authoredOn: string | null;
  status: string;
  priority: string | null;
  basedOn: string[];
  raw: Task;
}

// Reference strings can be relative ("Observation/123") or absolute (server URL + "/RiskAssessment/123") —
// evidence-linking only cares about the resourceType/id suffix, so normalize to that.
function referenceSuffix(reference: string | undefined): string | null {
  if (!reference) return null;
  const match = reference.match(/([A-Z]+\/[^/]+)$/i);
  return match ? match[1]! : null;
}

function toTaskSummary(task: Task): TaskSummary {
  const noteText =
    task.note && task.note.length > 0
      ? task.note
          .map((annotation) => annotation.text)
          .filter(Boolean)
          .join(" ")
      : null;

  const basedOn = (task.basedOn ?? [])
    .map((ref) => referenceSuffix(ref.reference))
    .filter((ref): ref is string => ref !== null);

  return {
    id: task.id ?? "",
    description: task.description ?? noteText ?? null,
    authoredOn: task.authoredOn ?? task.meta?.lastUpdated ?? null,
    status: task.status,
    priority: task.priority ?? null,
    basedOn,
    raw: task,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl =
    process.env.EHR_FHIR_SERVER_URL ?? "http://localhost:9090/fhir/r4";

  try {
    const client = new Client({ baseUrl });
    const bundle = (await client.resourceSearch({
      resourceType: "Task",
      searchParams: {
        patient: `Patient/${id}`,
        _sort: "-_lastUpdated",
        _count: 50,
      },
    })) as unknown as Bundle<Task>;

    const tasks = (bundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter((resource): resource is Task => resource !== undefined)
      .map(toTaskSummary);

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error("failed to fetch tasks from ehr-fhir-server", error);
    return NextResponse.json({ tasks: [] });
  }
}
