import { NextResponse } from "next/server";
import { generateText } from "ai";
import { aiEnabled, fastModel, modelName } from "@/lib/ai/client";
import { requireSession } from "@/server/rbac";
import {
  assertWithinBudget,
  recordUsage,
  CostBudgetExceededError,
} from "@/lib/ai/cost-guard";
import {
  buildProjectSummaryPrompt,
  fetchProjectSummaryContext,
} from "@/lib/ai/summaries";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!aiEnabled()) {
    return NextResponse.json({ error: "AI is disabled." }, { status: 503 });
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  try {
    await assertWithinBudget(session.user.id);
  } catch (err) {
    if (err instanceof CostBudgetExceededError) {
      return NextResponse.json(
        { error: `Daily AI budget exceeded (${err.used}/${err.budget} tokens).` },
        { status: 429 },
      );
    }
    throw err;
  }

  const { id } = await context.params;
  const ctx = await fetchProjectSummaryContext(id);
  if (!ctx) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { system, prompt } = buildProjectSummaryPrompt(ctx);

  try {
    const { text, usage } = await generateText({
      model: fastModel(),
      system,
      prompt,
    });

    await recordUsage({
      userId: session.user.id,
      feature: "summary-project",
      prompt: ctx.code,
      modelName: modelName("fast"),
      inputTok: usage?.promptTokens ?? 0,
      outputTok: usage?.completionTokens ?? 0,
      success: true,
    });

    return NextResponse.json({ summary: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordUsage({
      userId: session.user.id,
      feature: "summary-project",
      prompt: ctx.code,
      modelName: modelName("fast"),
      inputTok: 0,
      outputTok: 0,
      success: false,
      errorCode: message.slice(0, 120),
    }).catch(() => {});
    return NextResponse.json(
      { error: "Summary failed: " + message },
      { status: 500 },
    );
  }
}
