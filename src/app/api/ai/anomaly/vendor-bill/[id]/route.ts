import { NextResponse } from "next/server";
import { aiEnabled, extractJson, defaultModel, modelName } from "@/lib/ai/client";
import { requireRole } from "@/server/rbac";
import { Role } from "@prisma/client";
import {
  assertWithinBudget,
  recordUsage,
  CostBudgetExceededError,
} from "@/lib/ai/cost-guard";
import {
  VendorBillAnomalyOutput,
  buildVendorBillAnomalyPrompt,
  fetchVendorBillAnomalyContext,
} from "@/lib/ai/anomaly";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!aiEnabled()) {
    return NextResponse.json({ error: "AI is disabled." }, { status: 503 });
  }

  let session;
  try {
    // Only ADMIN/MANAGER can review vendor bills; restrict AI access similarly.
    session = await requireRole([Role.ADMIN, Role.MANAGER]);
  } catch {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
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
  const ctx = await fetchVendorBillAnomalyContext(id);
  if (!ctx) {
    return NextResponse.json({ error: "Bill not found." }, { status: 404 });
  }

  const { system, prompt } = buildVendorBillAnomalyPrompt(ctx);

  try {
    const { object, usage } = await extractJson({
      model: defaultModel(),
      schema: VendorBillAnomalyOutput,
      schemaName: "VendorBillAnomaly",
      system,
      prompt,
    });

    await recordUsage({
      userId: session.user.id,
      feature: "anomaly-vendor-bill",
      prompt: ctx.billNo,
      modelName: modelName("default"),
      inputTok: usage.promptTokens,
      outputTok: usage.completionTokens,
      success: true,
    });

    return NextResponse.json(object);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordUsage({
      userId: session.user.id,
      feature: "anomaly-vendor-bill",
      prompt: ctx.billNo,
      modelName: modelName("default"),
      inputTok: 0,
      outputTok: 0,
      success: false,
      errorCode: message.slice(0, 120),
    }).catch(() => {});
    return NextResponse.json(
      { error: "Anomaly scan failed: " + message },
      { status: 500 },
    );
  }
}
