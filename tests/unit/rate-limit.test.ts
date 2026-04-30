import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetForTests, clientIp, rateLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    _resetForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to `limit` attempts within the window", () => {
    for (let i = 0; i < 5; i++) {
      const r = rateLimit("k", 5, 60_000);
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks the (limit+1)th attempt with retryAfterMs", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", 5, 60_000);
    const r = rateLimit("k", 5, 60_000);
    expect(r.allowed).toBe(false);
    if (!r.allowed) {
      expect(r.retryAfterMs).toBeGreaterThan(0);
      expect(r.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("re-allows once the oldest attempt rolls off the window", () => {
    for (let i = 0; i < 5; i++) rateLimit("k", 5, 60_000);
    expect(rateLimit("k", 5, 60_000).allowed).toBe(false);
    // Advance just past the window for the first attempt.
    vi.advanceTimersByTime(60_001);
    expect(rateLimit("k", 5, 60_000).allowed).toBe(true);
  });

  it("isolates buckets by key", () => {
    for (let i = 0; i < 5; i++) rateLimit("a", 5, 60_000);
    expect(rateLimit("a", 5, 60_000).allowed).toBe(false);
    expect(rateLimit("b", 5, 60_000).allowed).toBe(true);
  });

  it("returns remaining count when allowed", () => {
    const r1 = rateLimit("k", 5, 60_000);
    if (r1.allowed) expect(r1.remaining).toBe(4);
    const r2 = rateLimit("k", 5, 60_000);
    if (r2.allowed) expect(r2.remaining).toBe(3);
  });
});

describe("clientIp", () => {
  it("uses x-forwarded-for first hop when present", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.1");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-real-ip": "203.0.113.2" },
    });
    expect(clientIp(req)).toBe("203.0.113.2");
  });

  it("returns 'unknown' when no proxy headers", () => {
    const req = new Request("http://localhost/");
    expect(clientIp(req)).toBe("unknown");
  });

  it("trims whitespace in x-forwarded-for", () => {
    const req = new Request("http://localhost/", {
      headers: { "x-forwarded-for": "  203.0.113.3  , 10.0.0.1" },
    });
    expect(clientIp(req)).toBe("203.0.113.3");
  });
});
