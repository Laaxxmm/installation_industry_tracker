import { NextResponse } from "next/server";
import { generateText } from "ai";
import { defaultModel, modelName, aiEnabled } from "@/lib/ai/client";
import { requireSession } from "@/server/rbac";
import { assertWithinBudget, recordUsage } from "@/lib/ai/cost-guard";

export const runtime = "nodejs";

// Dev smoke route. `GET /api/ai/ping` asks the model to reply "pong" so we
// can confirm the SDK, the API key, and the cost-guard / usage log all
// round-trip end to end. Not mounted in production UI; use curl or the
// browser to exercise.
export async function GET() {
  if (!aiEnabled()) {
    return NextResponse.json(
      { ok: false, error: "AI disabled (set AI_ENABLED=true)." },
      { status: 503 },
    );
  }

  const session = await requireSession();
  const userId = session.user.id;

  try {
    await assertWithinBudget(userId);
    const prompt = "Say pong.";
    const result = await generateText({ model: defaultModel(), prompt });
    const usage = result.usage ?? { promptTokens: 0, completionTokens: 0 };
    await recordUsage({
      userId,
      feature: "ping",
      prompt,
      modelName: modelName("default"),
      inputTok: usage.promptTokens ?? 0,
      outputTok: usage.completionTokens ?? 0,
      success: true,
    });
    return NextResponse.json({ ok: true, text: result.text, usage });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordUsage({
      userId,
      feature: "ping",
      prompt: "Say pong.",
      modelName: modelName("default"),
      inputTok: 0,
      outputTok: 0,
      success: false,
      errorCode: message.slice(0, 120),
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
