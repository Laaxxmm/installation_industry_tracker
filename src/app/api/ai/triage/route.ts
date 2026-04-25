import { NextResponse } from "next/server";
import { z } from "zod";
import { aiEnabled, extractJson, fastModel, modelName } from "@/lib/ai/client";
import { requireSession } from "@/server/rbac";
import {
  assertWithinBudget,
  recordUsage,
  CostBudgetExceededError,
} from "@/lib/ai/cost-guard";
import {
  TriageDraftOutput,
  buildTriagePrompt,
  fetchTriageContext,
} from "@/lib/ai/drafts";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  clientId: z.string().min(1),
  projectId: z.string().min(1),
  amcId: z.string().nullable().optional(),
  summary: z.string().min(5).max(400),
  description: z.string().max(4000).optional(),
  reportedAt: z.string().datetime().optional(),
});

export async function POST(req: Request) {
  if (!aiEnabled()) {
    return NextResponse.json({ error: "AI is disabled." }, { status: 503 });
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }
  const { clientId, projectId, amcId, summary, description, reportedAt } =
    parsed.data;

  // Run budget check and Prisma context fetch in parallel — independent reads.
  let context: Awaited<ReturnType<typeof fetchTriageContext>>;
  try {
    [, context] = await Promise.all([
      assertWithinBudget(session.user.id),
      fetchTriageContext({
        clientId,
        projectId,
        amcId: amcId ?? null,
        reportedAt: reportedAt ? new Date(reportedAt) : new Date(),
      }),
    ]);
  } catch (err) {
    if (err instanceof CostBudgetExceededError) {
      return NextResponse.json(
        { error: `Daily AI budget exceeded (${err.used}/${err.budget} tokens).` },
        { status: 429 },
      );
    }
    throw err;
  }

  const { system, prompt } = buildTriagePrompt({ summary, description, context });

  try {
    const { object, usage } = await extractJson({
      model: fastModel(),
      schema: TriageDraftOutput,
      schemaName: "TriageDraft",
      system,
      prompt,
    });

    await recordUsage({
      userId: session.user.id,
      feature: "triage",
      prompt: summary,
      modelName: modelName("fast"),
      inputTok: usage.promptTokens,
      outputTok: usage.completionTokens,
      success: true,
    });

    return NextResponse.json({
      ...object,
      derivedCoverage: context.derivedCoverage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordUsage({
      userId: session.user.id,
      feature: "triage",
      prompt: summary,
      modelName: modelName("fast"),
      inputTok: 0,
      outputTok: 0,
      success: false,
      errorCode: message.slice(0, 120),
    }).catch(() => {});
    return NextResponse.json(
      { error: "Triage failed: " + message },
      { status: 500 },
    );
  }
}
