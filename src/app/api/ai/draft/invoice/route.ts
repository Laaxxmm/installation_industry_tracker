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
  InvoiceDraftOutput,
  buildInvoiceDraftPrompt,
  fetchInvoiceContext,
} from "@/lib/ai/drafts";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  projectId: z.string().min(1),
  kind: z.enum(["ADVANCE", "PROGRESS", "FINAL", "ADHOC"]),
  brief: z.string().min(10).max(4000),
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
  const { projectId, kind, brief } = parsed.data;

  // Run rate limit, budget check, and Prisma context fetch in parallel —
  // all independent reads.
  let context: Awaited<ReturnType<typeof fetchInvoiceContext>>;
  try {
    [, , context] = await Promise.all([
      assertRateLimit(session.user.id),
      assertWithinBudget(session.user.id),
      fetchInvoiceContext(projectId),
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
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { system, prompt } = buildInvoiceDraftPrompt({
    brief,
    kind,
    context,
    supplierStateCode: process.env.SAB_STATE_CODE ?? "29",
  });

  try {
    const { object, usage } = await extractJson({
      schema: InvoiceDraftOutput,
      schemaName: "InvoiceDraft",
      system,
      prompt,
    });

    await recordUsage({
      userId: session.user.id,
      feature: "draft-invoice",
      prompt: brief,
      modelName: modelName("default"),
      inputTok: usage.promptTokens,
      outputTok: usage.completionTokens,
      success: true,
    });

    return NextResponse.json(object);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ai/draft/invoice] failed:", message);
    await recordUsage({
      userId: session.user.id,
      feature: "draft-invoice",
      prompt: brief,
      modelName: modelName("default"),
      inputTok: 0,
      outputTok: 0,
      success: false,
      errorCode: message.slice(0, 120),
    }).catch(() => {});
    return NextResponse.json(
      { error: "Invoice draft failed. Please retry." },
      { status: 500 },
    );
  }
}
