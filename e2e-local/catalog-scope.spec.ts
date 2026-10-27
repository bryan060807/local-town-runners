import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { templateWorkspace } from "../src/lib/demo-catalog";

const env = Object.fromEntries(
  (await readFile(".local-backend/app.env", "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
if (env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321")
  throw Error("Catalog scope fixtures require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const headers = { Origin: "http://127.0.0.1:3000" };
test.setTimeout(120000);
test.use({ actionTimeout: 15000 });

async function login(page: Page, role: "customer" | "admin") {
  await page.goto("/login");
  await page
    .getByLabel("Email", { exact: true })
    .fill(`${role}@local-town-runners.example`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(env.DEMO_SEED_PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/");
  // A present real-marketplace marker also proves the map finished rendering
  // before asserting that template/private runner markers are absent.
  await expect(
    page.getByRole("button", { name: "Riverbend Bakery (demo)", exact: true }),
  ).toBeVisible();
}

test("anonymous preview, real-account discovery and private demos use their intended catalog scopes", async ({
  page,
  browser,
}) => {
  const templateItem = await service
    .from("listings")
    .select("id,vendor_id,vendors!inner(demo_workspace)")
    .eq("title", "Handmade River Mug")
    .eq("vendors.demo_workspace", templateWorkspace)
    .single();
  expect(templateItem.error).toBeNull();
  const realVendors = await service
    .from("vendors")
    .select("id")
    .is("demo_workspace", null)
    .eq("active", true);
  expect(realVendors.error).toBeNull();
  const realVendorIds = new Set(realVendors.data!.map((vendor) => vendor.id));

  await page.goto("/");
  const search = page.getByRole("textbox", { name: "Search listings" });
  await search.fill("Demo Hearth Bakery");
  await expect(page.locator(".explore-vendor-card")).toHaveCount(1);
  await expect(page.locator(".explore-vendor-card")).toContainText(
    "Demo Hearth Bakery",
  );
  const preview = await page.request.post("/api/assistant", {
    headers,
    data: { message: "Tell me about Handmade River Mug" },
  });
  expect(preview.status()).toBe(200);
  expect(
    (await preview.json()).listings.map((item: { id: string }) => item.id),
  ).toEqual([templateItem.data!.id]);

  await login(page, "customer");
  await search.fill("Demo Hearth Bakery");
  await expect(page.locator(".explore-vendor-card")).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "Jordan Ellis · approximate location",
      exact: true,
    }),
  ).toHaveCount(0);
  const before = await page.request.get("/api/orders");
  expect(before.status()).toBe(200);
  const originalOrderIds = (await before.json()).orders.map(
    (order: { id: string }) => order.id,
  );
  for (const data of [
    { message: "Tell me about Handmade River Mug" },
    {
      message: "Get me two",
      previousListing: templateItem.data!.id,
      resultIds: [templateItem.data!.id],
    },
  ]) {
    const response = await page.request.post("/api/assistant", {
      headers,
      data,
    });
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.prepared).toBeUndefined();
    expect(
      result.listings.every((item: { vendorId: string }) =>
        realVendorIds.has(item.vendorId),
      ),
    ).toBe(true);
    expect(
      result.listings.map((item: { id: string }) => item.id),
    ).not.toContain(templateItem.data!.id);
  }
  const deniedCart = await page.request.post("/api/cart", {
    headers,
    data: { listingId: templateItem.data!.id, quantity: 1 },
  });
  expect(deniedCart.status()).toBe(409);
  const deniedOrder = await page.request.post("/api/orders", {
    headers,
    data: {
      listingId: templateItem.data!.id,
      quantity: 1,
      requestId: randomUUID(),
      deliveryAddress: "LOCAL TEST ADDRESS — catalog scope regression",
    },
  });
  expect(deniedOrder.status()).toBe(409);
  const after = await page.request.get("/api/orders");
  expect(after.status()).toBe(200);
  expect(
    (await after.json()).orders.map((order: { id: string }) => order.id),
  ).toEqual(originalOrderIds);

  const isolated = await browser.newContext({
    baseURL: "http://127.0.0.1:3000",
  });
  try {
    await service.from("demo_entry_limits").delete().neq("key_hash", "");
    const demo = await isolated.newPage();
    await demo.goto("/");
    await demo.getByRole("button", { name: "Enter Demo Mode" }).click();
    await expect(demo.getByLabel("Switch demo profile")).toBeEnabled();
    const ticket = (await isolated.cookies()).find(
      (cookie) => cookie.name === "ltr_demo_ticket",
    )!;
    const session = await service
      .from("demo_sessions")
      .select("workspace_id")
      .eq("token_hash", createHash("sha256").update(ticket.value).digest("hex"))
      .single();
    expect(session.error).toBeNull();
    const ownVendors = await service
      .from("vendors")
      .select("id")
      .eq("demo_workspace", session.data!.workspace_id);
    expect(ownVendors.error).toBeNull();
    const ownVendorIds = new Set(ownVendors.data!.map((vendor) => vendor.id));
    const ownItem = await isolated.request.post("/api/assistant", {
      headers,
      data: { message: "Tell me about Handmade River Mug" },
    });
    expect(ownItem.status()).toBe(200);
    const privateResult = await ownItem.json();
    expect(privateResult.listings).toHaveLength(1);
    expect(privateResult.listings[0].id).not.toBe(templateItem.data!.id);
    expect(ownVendorIds.has(privateResult.listings[0].vendorId)).toBe(true);
    await demo
      .getByRole("textbox", { name: "Search listings" })
      .fill("Riverbend Bakery");
    await expect(demo.locator(".explore-vendor-card")).toHaveCount(0);

    expect((await page.request.delete("/api/auth", { headers })).status()).toBe(
      200,
    );
    await login(page, "admin");
    await search.fill("Demo Hearth Bakery");
    await expect(page.locator(".explore-vendor-card")).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Jordan Ellis · approximate location",
        exact: true,
      }),
    ).toHaveCount(0);
    const admin = await page.request.post("/api/assistant", {
      headers,
      data: { message: "Tell me about Handmade River Mug" },
    });
    expect(admin.status()).toBe(200);
    const adminResult = await admin.json();
    expect(
      adminResult.listings.every((item: { vendorId: string }) =>
        realVendorIds.has(item.vendorId),
      ),
    ).toBe(true);
  } finally {
    expect(
      (await isolated.request.delete("/api/demo", { headers })).status(),
    ).toBe(200);
    await isolated.close();
  }
});
