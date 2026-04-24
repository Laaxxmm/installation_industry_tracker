import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject, type LanguageModelV1 } from "ai";
import type { z } from "zod";

// Central entry point for every LLM call in the app. Nothing outside
// `src/lib/ai` should import `@ai-sdk/anthropic` directly — route through
// `defaultModel()` / `fastModel()` so model names, provider and kill-switch
// stay in one place.

export function aiEnabled(): boolean {
  return process.env.AI_ENABLED === "true" && Boolean(process.env.ANTHROPIC_API_KEY);
}

export function requireAIEnabled(): void {
  if (!aiEnabled()) {
    throw new Error(
      "AI is disabled. Set AI_ENABLED=true and ANTHROPIC_API_KEY to use AI features.",
    );
  }
}

export function modelName(kind: "default" | "fast" = "default"): string {
  if (kind === "fast") {
    return process.env.AI_MODEL_FAST ?? "claude-haiku-4-5";
  }
  return process.env.AI_MODEL_DEFAULT ?? "claude-sonnet-4-5";
}

// Lazily-constructed provider so importing this file doesn't throw when the
// key is missing (e.g. during `next build` with no env set).
let cached: ReturnType<typeof createAnthropic> | null = null;
function anthropic() {
  if (!cached) {
    cached = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });
  }
  return cached;
}

export function defaultModel() {
  requireAIEnabled();
  return anthropic()(modelName("default"));
}

export function fastModel() {
  requireAIEnabled();
  return anthropic()(modelName("fast"));
}

// Structured JSON extraction with Zod validation. Used by draft/triage routes
// so AI output goes through the SAME schema the form would hand to the server
// action — a bad draft fails exactly where a bad paste would.
export async function extractJson<T>(opts: {
  model?: LanguageModelV1;
  schema: z.ZodType<T>;
  schemaName?: string;
  system: string;
  prompt: string;
}): Promise<{ object: T; usage: { promptTokens: number; completionTokens: number } }> {
  const { object, usage } = await generateObject({
    model: opts.model ?? defaultModel(),
    schema: opts.schema,
    schemaName: opts.schemaName,
    system: opts.system,
    prompt: opts.prompt,
  });
  return {
    object,
    usage: {
      promptTokens: usage?.promptTokens ?? 0,
      completionTokens: usage?.completionTokens ?? 0,
    },
  };
}
