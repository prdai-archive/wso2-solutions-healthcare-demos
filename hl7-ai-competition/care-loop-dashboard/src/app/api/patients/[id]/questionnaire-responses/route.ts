import type {
  Bundle,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
} from "fhir/r4";

import process from "node:process";

import { Client } from "fhir-kit-client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export interface QuestionnaireResponseAnswer {
  question: string;
  answer: string;
}

export interface QuestionnaireResponseSummary {
  id: string;
  questionnaireTitle: string | null;
  authored: string | null;
  answers: QuestionnaireResponseAnswer[];
}

function findTitle(items: QuestionnaireResponseItem[]): string | null {
  const titleItem = items.find((item) => item.linkId === "title");
  return titleItem?.text ?? null;
}

function stringifyAnswer(
  item: QuestionnaireResponseItem,
): string | undefined {
  const answer = item.answer?.[0];
  if (!answer) return undefined;
  if (answer.valueString !== undefined) return answer.valueString;
  if (answer.valueBoolean !== undefined) return String(answer.valueBoolean);
  if (answer.valueInteger !== undefined) return String(answer.valueInteger);
  return undefined;
}

// care-loop-collector-service only ever persists linkId (a UUID) on each item, never question text - fall back to a short slice of the linkId rather than dropping a real answer just because its label is missing.
function questionLabel(item: QuestionnaireResponseItem): string {
  return item.text ?? `Question ${item.linkId.slice(0, 8)}`;
}

function collectAnswers(
  items: QuestionnaireResponseItem[],
): QuestionnaireResponseAnswer[] {
  const answers: QuestionnaireResponseAnswer[] = [];

  for (const item of items) {
    const answer = stringifyAnswer(item);
    if (answer !== undefined) {
      answers.push({ question: questionLabel(item), answer });
    }
    if (item.item) {
      answers.push(...collectAnswers(item.item));
    }
  }

  return answers;
}

function toQuestionnaireResponseSummary(
  response: QuestionnaireResponse,
): QuestionnaireResponseSummary {
  const items = response.item ?? [];

  return {
    id: response.id ?? "",
    questionnaireTitle: findTitle(items),
    authored: response.authored ?? response.meta?.lastUpdated ?? null,
    answers: collectAnswers(items),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const baseUrl =
    process.env.CARE_LOOP_FHIR_SERVER_URL ?? "http://localhost:9091/fhir";

  try {
    const client = new Client({ baseUrl });
    const bundle = (await client.resourceSearch({
      resourceType: "QuestionnaireResponse",
      searchParams: {
        subject: `Patient/${id}`,
        _sort: "-_lastUpdated",
        _count: 50,
      },
    })) as unknown as Bundle<QuestionnaireResponse>;

    const responses = (bundle.entry ?? [])
      .map((entry) => entry.resource)
      .filter(
        (resource): resource is QuestionnaireResponse =>
          resource !== undefined,
      )
      .map(toQuestionnaireResponseSummary);

    return NextResponse.json({ responses });
  } catch (error) {
    console.error(
      "failed to fetch questionnaire responses from care-loop-fhir-server",
      error,
    );
    return NextResponse.json({ responses: [] });
  }
}
