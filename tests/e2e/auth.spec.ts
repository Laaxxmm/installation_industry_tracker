import { test, expect } from "@playwright/test";

// Requires: database seeded via `npm run db:seed`.
// Seed accounts (all password "password123"):
//   admin@sab.local  / ADMIN
//   manager@sab.local / MANAGER
//   super@sab.local   / SUPERVISOR
//   hourly@sab.local  / EMPLOYEE (₹200/hr)
//   salaried@sab.local / EMPLOYEE (₹60,000/month)

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign in/i }).click();
}

test("admin can sign in and see dashboard nav", async ({ page }) => {
  await signIn(page, "admin@sab.local");
  await expect(page).toHaveURL(/\/(dashboard|projects|$)/);
  await expect(page.getByText("ADMIN")).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
});

test("manager sees Overhead and Reports but not Users", async ({ page }) => {
  await signIn(page, "manager@sab.local");
  await expect(page.getByRole("link", { name: "Overhead" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Reports" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
});

test("supervisor does not see Overhead or Users", async ({ page }) => {
  await signIn(page, "super@sab.local");
  await expect(page.getByRole("link", { name: "Overhead" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
  // But inventory + timesheets are available
  await expect(page.getByRole("link", { name: "Inventory" })).toBeVisible();
});

test("employee redirected away from admin page", async ({ page }) => {
  await signIn(page, "hourly@sab.local");
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/forbidden/);
});

test("unauthenticated user redirected to login", async ({ page }) => {
  await page.goto("/projects");
  await expect(page).toHaveURL(/\/login/);
});
