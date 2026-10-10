import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const env = Object.fromEntries(
  (await readFile(".local-backend/app.env", "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
test("Sandbox diagnostics restrict access and report missing local credentials without payment side effects", async ({
  page,
}) => {
  await page.goto("/admin/payments");
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  expect(
    (
      await page.request.post("/api/admin/paypal-diagnostics", {
        headers: { Origin: "http://127.0.0.1:3000" },
      })
    ).status(),
  ).toBe(401);
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("customer@local-town-runners.example");
  await page
    .getByLabel("Password", { exact: true })
    .fill(env.DEMO_SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  expect(
    (
      await page.request.post("/api/admin/paypal-diagnostics", {
        headers: { Origin: "http://127.0.0.1:3000" },
      })
    ).status(),
  ).toBe(403);
  await page.context().clearCookies();
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("admin@local-town-runners.example");
  await page
    .getByLabel("Password", { exact: true })
    .fill(env.DEMO_SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/admin/payments");
  await expect(
    page.getByRole("heading", { name: "PayPal Sandbox authentication check" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check PayPal Sandbox authentication" })
    .click();
  await expect(page.getByRole("status")).toContainText("missing_configuration");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const r = await page.request.post("/api/admin/paypal-diagnostics", {
    headers: { Origin: "http://127.0.0.1:3000" },
  });
  expect(r.status()).toBe(200);
  expect(r.headers()["cache-control"]).toContain("no-store");
  const report = await r.json();
  expect(report.outcome).toBe("missing_configuration");
  expect(report).not.toHaveProperty("access_token");
  expect(JSON.stringify(report)).not.toContain(env.DEMO_SEED_PASSWORD);
});
