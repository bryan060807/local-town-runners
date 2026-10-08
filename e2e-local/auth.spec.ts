import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
test.setTimeout(60000);
const env = Object.fromEntries(
  (await readFile(".local-backend/app.env", "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
async function login(page: import("@playwright/test").Page, role: string) {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`${role}@local-town-runners.example`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(env.DEMO_SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
test("cookie-authenticated order preparation persists; missing PayPal configuration does not forge paid state", async ({
  page,
}) => {
  await login(page, "customer");
  await page.goto("/");
  await expect(page.getByText("Connected marketplace")).toBeVisible();
  const discovery = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/assistant") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "I'm hungry. What's good?" }).click();
  expect((await discovery).status()).toBe(200);
  await expect(page.locator(".mini-results")).toContainText(
    "Habanero Cinnamon Rolls",
  );
  const assistant = page.getByRole("textbox", {
    name: "Ask your local sidekick",
  });
  await assistant.fill("Wait. Habanero cinnamon rolls?");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.locator(".mini-results button")).toHaveCount(1);
  await assistant.fill("Get me two");
  const preview = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/assistant") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Send message" }).click();
  expect((await preview).status()).toBe(200);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("$9.00");
  await expect(dialog.getByRole("status")).toContainText("already heading");
  await dialog
    .getByPlaceholder("Delivery address (shared only with assigned runner)")
    .fill("LOCAL BROWSER TEST PRIVATE ADDRESS");
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/api/orders") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Prepare order" }).click();
  const r = await response;
  expect(r.status()).toBe(200);
  const d = await r.json();
  const orderId = d.order.id;
  try {
    await expect(page).toHaveURL(/\/dashboard/);
    const card = page.locator(".simple-card").filter({ hasText: orderId });
    await expect(card).toContainText("$9.00", { timeout: 15000 });
    await expect(card).toContainText("DRAFT");
    await card.getByRole("button", { name: "Pay with PayPal Sandbox" }).click();
    await expect(card.getByRole("status")).toContainText(
      "PayPal Sandbox is not configured",
    );
    await expect(card).toContainText("DRAFT");
    await card.getByRole("button", { name: "Cancel draft" }).click();
    await expect(
      page.locator(".simple-card").filter({ hasText: orderId }),
    ).toContainText("CANCELLED");
  } finally {
    const service = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
    );
    const current = await service
      .from("orders")
      .select("state")
      .eq("id", orderId)
      .single();
    if (current.data?.state === "DRAFT") {
      const cancel = await page.request.delete("/api/orders", {
        headers: { Origin: "http://127.0.0.1:3000" },
        data: { orderId },
      });
      expect(cancel.ok()).toBe(true);
    }
    for (const table of ["order_private", "order_events"]) {
      const { error } = await service
        .from(table)
        .delete()
        .eq("order_id", orderId);
      if (error) throw error;
    }
    const { error } = await service.from("orders").delete().eq("id", orderId);
    if (error) throw error;
  }
});
test("role dashboards have separate capabilities", async ({ browser }) => {
  for (const role of ["vendor", "runner", "admin"]) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, role);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (role === "vendor") {
      await expect(
        page.getByRole("heading", { name: "Your catalog" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Admin / moderation" }),
      ).toHaveCount(0);
    }
    if (role === "runner") {
      await expect(
        page.getByRole("heading", { name: "Runner availability" }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Your catalog" }),
      ).toHaveCount(0);
    }
    if (role === "admin")
      await expect(
        page.getByRole("heading", { name: "Admin / moderation" }),
      ).toBeVisible();
    await context.close();
  }
});
