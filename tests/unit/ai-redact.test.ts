import { describe, expect, it } from "vitest";
import { redactPII, hashPrompt } from "@/lib/ai/redact";

describe("redactPII — Indian PII patterns", () => {
  it("redacts GSTIN", () => {
    const out = redactPII("Our GSTIN is 29AAAAA0000A1Z5 for Karnataka.");
    expect(out).toContain("[GSTIN_REDACTED]");
    expect(out).not.toContain("29AAAAA0000A1Z5");
  });

  it("redacts PAN", () => {
    const out = redactPII("PAN: ABCDE1234F on record.");
    expect(out).toContain("[PAN_REDACTED]");
    expect(out).not.toContain("ABCDE1234F");
  });

  it("redacts IFSC", () => {
    const out = redactPII("Bank IFSC HDFC0001234 was confirmed.");
    expect(out).toContain("[IFSC_REDACTED]");
    expect(out).not.toContain("HDFC0001234");
  });

  it("redacts a bare 10-digit Indian mobile", () => {
    const out = redactPII("Call 9876543210 for details.");
    expect(out).toContain("[PHONE_REDACTED]");
    expect(out).not.toContain("9876543210");
  });

  it("redacts +91-prefixed Indian mobile", () => {
    const out = redactPII("Reach me at +91-9876543210 anytime.");
    // The `+` sits outside the pattern's word boundary but the digits are scrubbed.
    expect(out).toContain("[PHONE_REDACTED]");
    expect(out).not.toContain("9876543210");
  });

  it("redacts a standalone bank-account-shaped digit run", () => {
    const out = redactPII("A/c 123456789012 credited.");
    expect(out).toContain("[BANK_ACCOUNT_REDACTED]");
    expect(out).not.toContain("123456789012");
  });

  it("redacts multiple PII of different types in one string", () => {
    const out = redactPII(
      "Client GSTIN 29AAAAA0000A1Z5, PAN ABCDE1234F, IFSC HDFC0001234, mobile 9876543210.",
    );
    expect(out).toContain("[GSTIN_REDACTED]");
    expect(out).toContain("[PAN_REDACTED]");
    expect(out).toContain("[IFSC_REDACTED]");
    expect(out).toContain("[PHONE_REDACTED]");
    expect(out).not.toContain("29AAAAA0000A1Z5");
    expect(out).not.toContain("ABCDE1234F");
    expect(out).not.toContain("HDFC0001234");
    expect(out).not.toContain("9876543210");
  });

  it("redacts every GSTIN when multiple appear", () => {
    const out = redactPII("Vendors: 29AAAAA0000A1Z5 and 33BBBBB1111B1Z5.");
    const count = (out.match(/\[GSTIN_REDACTED\]/g) ?? []).length;
    expect(count).toBe(2);
  });

  it("leaves non-PII text unchanged", () => {
    const input = "Installed 4 AC units at Bangalore office on 2026-04-20.";
    expect(redactPII(input)).toBe(input);
  });

  it("returns empty string unchanged", () => {
    expect(redactPII("")).toBe("");
  });

  it("does not match PAN inside a longer alphanumeric token", () => {
    // The `\b` guard should stop PAN from matching glued tokens like invoice IDs.
    const out = redactPII("Ref XABCDE1234FY needs review.");
    expect(out).toBe("Ref XABCDE1234FY needs review.");
  });

  it("processes GSTIN before PAN so the embedded PAN isn't double-redacted", () => {
    // GSTIN `29AAAAA0000A1Z5` contains the PAN `AAAAA0000A`. Since GSTIN runs
    // first, the full token is replaced with [GSTIN_REDACTED] and the leftover
    // string has no PAN pattern for the later rule to match.
    const out = redactPII("GSTIN 29AAAAA0000A1Z5 only.");
    expect(out).toBe("GSTIN [GSTIN_REDACTED] only.");
    expect(out).not.toContain("[PAN_REDACTED]");
  });
});

describe("hashPrompt", () => {
  it("is deterministic (same input → same hash)", async () => {
    const a = await hashPrompt("Show unpaid invoices for Acme.");
    const b = await hashPrompt("Show unpaid invoices for Acme.");
    expect(a).toBe(b);
  });

  it("returns 64-char lowercase hex (SHA-256)", async () => {
    const h = await hashPrompt("any input");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different inputs", async () => {
    const a = await hashPrompt("one");
    const b = await hashPrompt("two");
    expect(a).not.toBe(b);
  });

  it("hashes the redacted form, so inputs that differ only in PII collide", async () => {
    const a = await hashPrompt("Client PAN ABCDE1234F overdue.");
    const b = await hashPrompt("Client PAN ZZZZZ9999Z overdue.");
    expect(a).toBe(b);
  });
});
