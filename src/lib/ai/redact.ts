// Scrub Indian PII before a prompt is hashed + stored in AIPromptLog, and
// before any user-authored text is fed into an LLM system prompt. The raw
// strings may still be visible to the LLM in the *user* message (that's
// unavoidable for the agent to be useful) — this module only protects
// persisted logs and the system-prompt context surface.

const PATTERNS: Array<{ name: string; re: RegExp }> = [
  // GSTIN: 2-digit state + 5-letter PAN prefix + 4-digit PAN middle + PAN letter + entity digit + Z + check char.
  { name: "GSTIN", re: /\b\d{2}[A-Z]{5}\d{4}[A-Z][0-9A-Z]Z[0-9A-Z]\b/g },
  // PAN: 5 letters + 4 digits + 1 letter.
  { name: "PAN", re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  // IFSC: 4-letter bank code + 0 + 6-char branch code.
  { name: "IFSC", re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
  // Indian mobile: optional +91 / 91 / 0 prefix, then 6-9 start, then 9 digits.
  { name: "PHONE", re: /\b(?:\+?91[-\s]?|0)?[6-9]\d{9}\b/g },
  // Bank account: conservative — 9 to 18 digits as a standalone token.
  { name: "BANK_ACCOUNT", re: /\b\d{9,18}\b/g },
];

export function redactPII(text: string): string {
  let out = text;
  for (const { name, re } of PATTERNS) {
    out = out.replace(re, `[${name}_REDACTED]`);
  }
  return out;
}

// Stable, non-reversible hash for prompt deduplication / observability. Uses
// SHA-256 via node:crypto so it works in the Node runtime route handlers use.
export async function hashPrompt(text: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(redactPII(text)).digest("hex");
}
