import { NextResponse } from "next/server";
import { generateText } from "ai";
import { aiEnabled, fastModel, modelName } from "@/lib/ai/client";
import { requireSession } from "@/server/rbac";
import {
  assertRateLimit,
  assertWithinBudget,
  recordUsage,
  CostBudgetExceededError,
  RateLimitedError,
} from "@/lib/ai/cost-guard";
import {
  buildServiceIssueSummaryPrompt,
  fetchServiceIssueSummaryContext,
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

  const { id } = await context.params;

  // Run rate limit, budget check, and Prisma context fetch in parallel —
  // all independent reads.
  let ctx: Awaited<ReturnType<typeof fetchServiceIssueSummaryContext>>;
  try {
    [, , ctx] = await Promise.all([
      assertRateLimit(session.user.id),
      assertWithinBudget(session.user.id),
      fetchServiceIssueSummaryContext(id),
    ]);
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return NextResponse.json(
        { error: "Too many AI requests. Please wait a few seconds." },
        { status: 429, headers: { "Retry-After": String(err.retryAfterSeconds) } },
      );
    }
    if (err instanceof CostBudgetExceededError) {
      return NextResponse.json(
        { error: `Daily AI budget exceeded (${err.used}/${err.budget} tokens).` },
        { status: 429 },
      );
    }
    throw err;
  }

  if (!ctx) {
    return NextResponse.json({ error: "Issue not found." }, { status: 404 });
  }

  const { system, prompt } = buildServiceIssueSummaryPrompt(ctx);

  try {
    const { text, usage } = await generateText({
      model: fastModel(),
      system,
      prompt,
    });

    await recordUsage({
      userId: session.user.id,
      feature: "summary-service-issue",
      prompt: ctx.ticketNo,
      modelName: modelName("fast"),
      inputTok: usage?.promptTokens ?? 0,
      outputTok: usage?.completionTokens ?? 0,
      success: true,
    });

    return NextResponse.json({ summary: text });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ai/summary/service-issue] failed:", message);
    await recordUsage({
      userId: session.user.id,
      feature: "summary-service-issue",
      prompt: ctx.ticketNo,
      modelName: modelName("fast"),
      inputTok: 0,
      outputTok: 0,
      success: false,
      errorCode: message.slice(0, 120),
    }).catch(() => {});
    return NextResponse.json(
      { error: "Summary failed. Please retry." },
      { status: 500 },
    );
  }
}
