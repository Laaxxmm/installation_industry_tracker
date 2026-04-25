import { db } from "@/server/db";
import { Prisma } from "@prisma/client";
import { hashPrompt } from "./redact";

// Per-user daily token budget check and usage recorder. Called by every
// LLM-serving route before the upstream request (`assertWithinBudget`) and
// after it (`recordUsage`). The daily window is a rolling 24h, not a
// calendar day — simpler and harder to game.

function budgetPerUser(): number {
  const raw = process.env.AI_DAILY_TOKEN_BUDGET_PER_USER;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 500_000;
}

export class CostBudgetExceededError extends Error {
  constructor(public used: number, public budget: number) {
    super(`Daily AI token budget exceeded (${used}/${budget}).`);
    this.name = "CostBudgetExceededError";
  }
}

export class RateLimitedError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Too many AI requests. Retry in ${retryAfterSeconds}s.`);
    this.name = "RateLimitedError";
  }
}

export async function usedTokensLast24h(userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rows = await db.aIPromptLog.findMany({
    where: { userId, at: { gte: since } },
    select: { inputTok: true, outputTok: true },
  });
  return rows.reduce((sum, r) => sum + r.inputTok + r.outputTok, 0);
}

export async function assertWithinBudget(userId: string): Promise<void> {
  const used = await usedTokensLast24h(userId);
  const budget = budgetPerUser();
  if (used >= budget) throw new CostBudgetExceededError(used, budget);
}

// Per-user request-rate limit. Bursts of >`max` AI calls in `windowSec`
// throw `RateLimitedError`. Backed by AIPromptLog so it works across
// multiple Railway replicas (vs. an in-memory token-bucket which would
// be per-instance only). Defaults to 5 req / 10s — generous for normal
// human use, tight enough to throttle a script.
export async function assertRateLimit(
  userId: string,
  opts?: { windowSec?: number; max?: number },
): Promise<void> {
  const windowSec = opts?.windowSec ?? 10;
  const max = opts?.max ?? 5;
  const since = new Date(Date.now() - windowSec * 1000);
  const recent = await db.aIPromptLog.count({
    where: { userId, at: { gte: since } },
  });
  if (recent >= max) throw new RateLimitedError(windowSec);
}

export interface UsageRecord {
  userId: string | null;
  feature: string;
  prompt: string;
  modelName: string;
  inputTok: number;
  outputTok: number;
  costInr?: number;
  success: boolean;
  errorCode?: string | null;
}

export async function recordUsage(u: UsageRecord): Promise<void> {
  const promptHash = await hashPrompt(u.prompt);
  await db.aIPromptLog.create({
    data: {
      userId: u.userId,
      feature: u.feature,
      promptHash,
      modelName: u.modelName,
      inputTok: u.inputTok,
      outputTok: u.outputTok,
      costInr: new Prisma.Decimal(u.costInr ?? 0),
      success: u.success,
      errorCode: u.errorCode ?? null,
    },
  });
}
