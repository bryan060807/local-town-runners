import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(
  (await readFile(".local-backend/app.env", "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const origin = "http://127.0.0.1:3000";
const headers = { Origin: origin };
test("payment recovery shows pending eCheck and verified capture states without repeated checkout; ownership remains enforced", async ({
  page,
}) => {
  expect(
    (
      await page.request.post("/api/payments/status", {
        headers,
        data: { orderId: randomUUID() },
      })
    ).status(),
  ).toBe(401);
  const service = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const customer = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const signed = await customer.auth.signInWithPassword({
    email: "customer@local-town-runners.example",
    password: env.DEMO_SEED_PASSWORD,
  });
  expect(signed.error).toBeNull();
  const listings = await customer
    .from("listings")
    .select("id")
    .eq("active", true)
    .gt("inventory", 4)
    .limit(1);
  expect(listings.data?.length).toBe(1);
  const prepared = await customer.rpc("prepare_order", {
    listing_id: listings.data![0].id,
    qty: 1,
    request_key: randomUUID(),
    delivery_address: "Fictional local payment browser fixture",
  });
  expect(prepared.error).toBeNull();
  const id = prepared.data.id;
  expect(
    (
      await service.rpc("attach_verified_paypal_order", {
        order_id: id,
        paypal_id: "LOCAL-BROWSER-" + randomUUID(),
        customer_id: signed.data.user!.id,
      })
    ).error,
  ).toBeNull();
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("customer@local-town-runners.example");
  await page
    .getByLabel("Password", { exact: true })
    .fill(env.DEMO_SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  let phase = "capture_pending",
    financialRequests = 0;
  // UI fixture only. No mocked response is counted as provider success.
  await page.route("**/api/payments/status", async (route) => {
    if (route.request().postDataJSON().orderId !== id) return route.continue();
    await route.fulfill({
      json: {
        payment: { phase, captureId: "LOCAL-ONLY", pendingReason: "ECHECK" },
      },
    });
  });
  await page.route("**/api/capture", async (route) => {
    financialRequests++;
    await route.fulfill({
      status: 202,
      json: {
        payment: { phase: "confirmation_pending", captureId: "LOCAL-ONLY" },
      },
    });
  });
  await page.reload();
  const card = page.locator(".simple-card").filter({ hasText: "Order " + id });
  await expect(card).toContainText("PayPal is processing your eCheck");
  await expect(
    card.getByRole("button", { name: "Pay with PayPal Sandbox" }),
  ).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Confirm approved payment" }),
  ).toHaveCount(0);
  await card
    .getByRole("button", { name: "Check existing payment status" })
    .click();
  await expect(card).toContainText("not completed yet");
  expect(financialRequests).toBe(0);
  phase = "approved";
  await card
    .getByRole("button", { name: "Check existing payment status" })
    .click();
  await expect(
    card.getByRole("button", { name: "Confirm approved payment" }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Confirm approved payment" }).click();
  await expect(card).toContainText("Payment received — confirming your order");
  await expect(
    card.getByRole("button", { name: "Confirm approved payment" }),
  ).toHaveCount(0);
  expect(financialRequests).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.unroute("**/api/payments/status");
  await page.unroute("**/api/capture");
  expect(
    (
      await page.request.post("/api/payments/status", {
        headers: { Origin: "https://untrusted.invalid" },
        data: { orderId: id },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post("/api/payments/status", {
        headers,
        data: { orderId: id },
      })
    ).status(),
  ).toBe(503); // Local wrappers intentionally clear provider credentials.
  await page.context().clearCookies();
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill("vendor@local-town-runners.example");
  await page
    .getByLabel("Password", { exact: true })
    .fill(env.DEMO_SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  expect(
    (
      await page.request.post("/api/payments/status", {
        headers,
        data: { orderId: id },
      })
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post("/api/capture", {
        headers,
        data: { orderId: id },
      })
    ).status(),
  ).toBe(404);
});
