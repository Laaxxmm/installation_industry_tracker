import { NextResponse } from "next/server";
import { streamText, type Message } from "ai";
import { z } from "zod";
import { aiEnabled, defaultModel, modelName } from "@/lib/ai/client";
import { requireSession } from "@/server/rbac";
import {
  assertRateLimit,
  assertWithinBudget,
  recordUsage,
  CostBudgetExceededError,
  RateLimitedError,
} from "@/lib/ai/cost-guard";
import { buildReadTools } from "@/lib/ai/tools/read-tools";
import { buildChatSystemPrompt } from "@/lib/ai/prompts/chat";

export const runtime = "nodejs";
export const maxDuration = 60;

// Defensive bounds — block oversized payloads at the gate before they hit
// Anthropic. The Vercel AI SDK's `Message` type is structural; we validate
// shape but pass through to streamText.
const ChatBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system", "data"]),
        content: z.union([
          z.string().max(50_000),
          z.array(z.unknown()).max(50),
        ]),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(req: Request) {
  if (!aiEnabled()) {
    return NextResponse.json(
      { error: "AI is disabled. Set AI_ENABLED=true and ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = ChatBody.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request body." },
      { status: 400 },
    );
  }

  try {
    await Promise.all([
      assertRateLimit(session.user.id),
      assertWithinBudget(session.user.id),
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
        { error: `Daily AI budget exceeded (${err.used}/${err.budget} tokens). Try again in 24h.` },
        { status: 429 },
      );
    }
    throw err;
  }

  const messages = parsed.data.messages as Message[];
  const lastUserMsg = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const promptForHash = typeof lastUserMsg === "string" ? lastUserMsg : JSON.stringify(lastUserMsg);

  const systemPrompt = buildChatSystemPrompt({
    userName: session.user.name ?? "there",
    userRole: session.user.role,
  });
  const tools = buildReadTools({ session });

  const result = streamText({
    model: defaultModel(),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 5,
    onFinish: async ({ usage, finishReason }) => {
      try {
        await recordUsage({
          userId: session.user.id,
          feature: "chat",
          prompt: promptForHash,
          modelName: modelName("default"),
          inputTok: usage?.promptTokens ?? 0,
          outputTok: usage?.completionTokens ?? 0,
          success: finishReason !== "error",
          errorCode: finishReason === "error" ? "stream_error" : null,
        });
      } catch {
        // Never fail the response because usage logging failed.
      }
    },
  });

  return result.toDataStreamResponse();
}
