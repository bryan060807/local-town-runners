import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
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
if (env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321")
  throw Error("Authenticated browser fixtures require the local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
let pickupVendor: string;
test.beforeAll(async () => {
  // This quote assertion depends on the known seed runner's current trip.
  // Renew only that local fixture instead of depending on when seeding ran.
  const tripId = "00000000-0000-4000-8000-000000000500";
  const trip = await service
    .from("runner_trips")
    .select("runner_id,destination_vendor_id")
    .eq("id", tripId)
    .single();
  expect(trip.error).toBeNull();
  pickupVendor = trip.data!.destination_vendor_id;
  expect(pickupVendor).toBe("00000000-0000-4000-8000-000000000001");
  const until = new Date(Date.now() + 3 * 3600000).toISOString();
  expect(
    (
      await service
        .from("runner_trips")
        .update({ expires_at: until })
        .eq("id", tripId)
    ).error,
  ).toBeNull();
  expect(
    (
      await service
        .from("runners")
        .update({ available_until: until })
        .eq("id", trip.data!.runner_id)
    ).error,
  ).toBeNull();
});
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
  // Public template and legacy catalogs both contain cinnamon rolls. An
  // unsorted query can change their order after inventory updates, so this
  // test owns one uniquely named item at the known runner-trip destination.
  const title = `LOCAL auth pastry ${randomUUID()}`;
  const fixture = await service
    .from("listings")
    .insert({
      vendor_id: pickupVendor,
      title,
      description: "Fictional local authentication browser fixture only.",
      category: "Food",
      mode: "SELL",
      price_cents: 450,
      inventory: 12,
      active: true,
      made_local: true,
    })
    .select("id")
    .single();
  expect(fixture.error).toBeNull();
  let orderId: string | undefined;
  try {
    await login(page, "customer");
    await page.goto("/");
    await expect(page.getByText("Connected marketplace")).toBeVisible();
    const discovery = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/assistant") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "I'm hungry. What's good?" })
      .click();
    const discovered = await discovery;
    expect(discovered.status()).toBe(200);
    const food = (await discovered.json()).listings;
    expect(food.length).toBeGreaterThan(0);
    expect(food.length).toBeLessThanOrEqual(4);
    expect(
      food.every((item: { category: string }) => item.category === "Food"),
    ).toBe(true);
    await expect(page.locator(".mini-results button")).toHaveCount(food.length);
    const assistant = page.getByRole("textbox", {
      name: "Ask your local sidekick",
    });
    await assistant.fill(`Tell me about ${title}`);
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.locator(".mini-results button")).toHaveCount(1);
    await expect(page.locator(".mini-results button")).toContainText(title);
    await assistant.fill("Get me two");
    const preview = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/assistant") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Send message" }).click();
    const quote = await preview;
    expect(quote.status()).toBe(200);
    expect((await quote.json()).prepared.listingId).toBe(fixture.data!.id);
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(title);
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
    orderId = d.order.id;
    expect(d.order.listing_id).toBe(fixture.data!.id);
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
    if (orderId) {
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
    const { error } = await service
      .from("listings")
      .delete()
      .eq("id", fixture.data!.id);
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
