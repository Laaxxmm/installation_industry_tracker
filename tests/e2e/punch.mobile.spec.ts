import { test, expect } from "@playwright/test";

/**
 * Mobile PWA shell smoke test.
 *
 * Runs only under the `mobile-chromium` project in playwright.config.ts.
 */

test("employee opens /punch on mobile and sees the punch widget", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("hourly@sab.local");
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.goto("/punch");
  // Either "Punch in" button (no open entry) or "Punch out" / "Switch project" (already punched in)
  const anyPunchCtrl = page.getByRole("button", { name: /punch (in|out)|switch project/i });
  await expect(anyPunchCtrl.first()).toBeVisible();
});

test("manifest.webmanifest is served", async ({ page }) => {
  const resp = await page.goto("/manifest.webmanifest");
  expect(resp?.status()).toBeLessThan(400);
  const body = await resp?.text();
  expect(body).toMatch(/start_url/);
});
