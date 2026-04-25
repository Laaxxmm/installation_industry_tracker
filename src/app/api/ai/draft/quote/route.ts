import { NextResponse } from "next/server";
import { z } from "zod";
import { aiEnabled, extractJson, modelName } from "@/lib/ai/client";
import { requireSession } from "@/server/rbac";
import {
  assertRateLimit,
  assertWithinBudget,
  recordUsage,
  CostBudgetExceededError,
  RateLimitedError,
} from "@/lib/ai/cost-guard";
import {
  QuoteDraftOutput,
  buildQuoteDraftPrompt,
  fetchQuoteContext,
} from "@/lib/ai/drafts";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  clientId: z.string().min(1),
  brief: z.string().min(10).max(4000),
});

export async function POST(req: Request) {
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "AI is disabled." },
      { status: 503 },
    );
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
  const { clientId, brief } = parsed.data;

  // Run rate limit, budget check, and Prisma context fetch in parallel —
  // all independent reads.
  let context: Awaited<ReturnType<typeof fetchQuoteContext>>;
  try {
    [, , context] = await Promise.all([
      assertRateLimit(session.user.id),
      assertWithinBudget(session.user.id),
      fetchQuoteContext(clientId),
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

  if (!context) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const { system, prompt } = buildQuoteDraftPrompt({
    brief,
    context,
    supplierStateCode: process.env.SAB_STATE_CODE ?? "29",
  });

  try {
    const { object, usage } = await extractJson({
      schema: QuoteDraftOutput,
      schemaName: "QuoteDraft",
      system,
      prompt,
    });

    await recordUsage({
      userId: session.user.id,
      feature: "draft-quote",
      prompt: brief,
      modelName: modelName("default"),
      inputTok: usage.promptTokens,
      outputTok: usage.completionTokens,
      success: true,
    });

    return NextResponse.json(object);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ai/draft/quote] failed:", message);
    await recordUsage({
      userId: session.user.id,
      feature: "draft-quote",
      prompt: brief,
      modelName: modelName("default"),
      inputTok: 0,
      outputTok: 0,
      success: false,
      errorCode: message.slice(0, 120),
    }).catch(() => {});
    return NextResponse.json(
      { error: "Quote draft failed. Please retry." },
      { status: 500 },
    );
  }
}
