import { test, expect } from "@playwright/test";

/**
 * Golden-path smoke test (matches plan verification §9).
 *
 * Assumes the seed has run (`npm run db:seed`) and project SAB-2026-0001
 * exists with budget lines for MATERIAL/LABOR/OTHER.
 *
 * This spec exercises the end-to-end UI shell without reseeding between
 * runs — it asserts pages render with expected labels and that the seeded
 * project + its P&L / ledger / materials tabs load. Deep numerical
 * correctness is covered by the unit tests in tests/unit/pnl.test.ts.
 */

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe("golden path — manager views project portfolio", () => {
  test("manager sees seeded project on Projects page", async ({ page }) => {
    await signIn(page, "manager@sab.local");
    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page.getByText("SAB-2026-0001")).toBeVisible();
  });

  test("Reports page loads portfolio P&L", async ({ page }) => {
    await signIn(page, "manager@sab.local");
    await page.goto("/reports");
    await expect(page.getByRole("heading", { name: /portfolio/i })).toBeVisible();
    await expect(page.getByText(/net p&l/i).first()).toBeVisible();
    // The seeded project should appear in the rows.
    await expect(page.getByText("SAB-2026-0001").first()).toBeVisible();
  });

  test("Project P&L page renders breakdown", async ({ page }) => {
    await signIn(page, "manager@sab.local");
    await page.getByRole("link", { name: "Projects" }).click();
    await page.getByText("SAB-2026-0001").first().click();
    await page.getByRole("link", { name: "P&L" }).click();
    await expect(page.getByRole("heading", { name: /P&L/ })).toBeVisible();
    await expect(page.getByText(/contribution margin/i).first()).toBeVisible();
    await expect(page.getByText(/budget vs actual/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /export xlsx/i })).toBeVisible();
  });

  test("Ledger page renders", async ({ page }) => {
    await signIn(page, "manager@sab.local");
    await page.goto("/projects"); // navigate via list
    const projectLink = page.getByText("SAB-2026-0001").first();
    await projectLink.click();
    await page.getByRole("link", { name: "Ledger" }).click();
    await expect(page.getByRole("heading", { name: /ledger/i })).toBeVisible();
  });

  test("Overhead page form renders for manager", async ({ page }) => {
    await signIn(page, "manager@sab.local");
    await page.goto("/overhead");
    await expect(page.getByRole("heading", { name: /overhead/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /save overhead/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /book invoice/i })).toBeVisible();
  });
});
