import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

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
  throw Error("Showcase fixtures require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const headers = { Origin: "http://127.0.0.1:3000" };
test.setTimeout(120000);
test.use({ actionTimeout: 15000 });

test("public vendor previews remain read-only while demo shopping and AI stay isolated", async ({
  page,
}, info) => {
  const vendorId = randomUUID();
  const listingId = randomUUID();
  const inactiveId = randomUUID();
  const prohibitedId = randomUUID();
  const name = `AAA LOCAL SHOWCASE FIXTURE ${vendorId.slice(0, 8)}`;
  const itemName = `LOCAL SHOWCASE CROCHET ${listingId.slice(0, 8)}`;
  const financialRequests: string[] = [];
  const pageErrors: string[] = [];
  const browserMutations: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method()))
      browserMutations.push(
        request.method() + " " + new URL(request.url()).pathname,
      );
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      /^\/api\/(checkout|capture|refunds|payments\/status|demo\/orders\/simulate)(\/|$)/.test(
        url.pathname,
      ) ||
      /(^|\.)paypal\.com$/.test(url.hostname)
    ) {
      financialRequests.push(request.method() + " " + url.pathname);
      await route.abort();
    } else await route.continue();
  });

  let customerId: string | undefined;
  async function customerRows() {
    if (!customerId) throw Error("Private demo identity required");
    const [orders, cart, inquiries] = await Promise.all([
      service.from("orders").select("id").eq("customer_id", customerId),
      service
        .from("cart_items")
        .select("listing_id,quantity")
        .eq("customer_id", customerId),
      service.from("inquiries").select("id").eq("customer_id", customerId),
    ]);
    expect(orders.error).toBeNull();
    expect(cart.error).toBeNull();
    expect(inquiries.error).toBeNull();
    return {
      orders: orders.data!,
      cart: cart.data!,
      inquiries: inquiries.data!,
    };
  }
  async function sourceListing() {
    const result = await service
      .from("listings")
      .select("id,vendor_id,inventory,price_cents,active,prohibited")
      .eq("id", listingId)
      .single();
    expect(result.error).toBeNull();
    return result.data!;
  }

  try {
    const owner = await service
      .from("vendors")
      .select("owner_id")
      .eq("demo", true)
      .is("demo_workspace", null)
      .order("id")
      .limit(1)
      .single();
    expect(owner.error).toBeNull();
    expect(owner.data?.owner_id).toBeTruthy();
    expect(
      (
        await service.from("vendors").insert({
          id: vendorId,
          owner_id: owner.data!.owner_id,
          name,
          slug: `local-showcase-${vendorId}`,
          description:
            "Local automated public-preview fixture, not an actual participating business.",
          category: "Makers",
          public_lon: -91.05,
          public_lat: 39.45,
          demo: false,
          verified: false,
          active: true,
        })
      ).error,
    ).toBeNull();
    expect(
      (
        await service.from("listings").insert([
          {
            id: listingId,
            vendor_id: vendorId,
            title: itemName,
            description:
              "Public source item reserved for read-only preview verification.",
            category: "Makers",
            mode: "SELL",
            price_cents: 2500,
            inventory: 3,
            active: true,
            prohibited: false,
            emoji: "🧶",
          },
          {
            id: inactiveId,
            vendor_id: vendorId,
            title: "LOCAL SHOWCASE INACTIVE ITEM",
            description: "Inactive listing must not enter the public preview.",
            category: "Makers",
            mode: "SELL",
            price_cents: 1000,
            inventory: 1,
            active: false,
            prohibited: false,
            emoji: "🧶",
          },
          {
            id: prohibitedId,
            vendor_id: vendorId,
            title: "LOCAL SHOWCASE PROHIBITED ITEM",
            description: "Moderated listing must not enter the public preview.",
            category: "Makers",
            mode: "SELL",
            price_cents: 1000,
            inventory: 1,
            active: true,
            prohibited: true,
            emoji: "🧶",
          },
        ])
      ).error,
    ).toBeNull();

    expect(
      (await service.from("demo_entry_limits").delete().neq("key_hash", ""))
        .error,
    ).toBeNull();
    await page.goto("/");
    await page
      .getByRole("button", { name: "Enter Demo Mode", exact: true })
      .click();
    await expect(page.getByLabel("Switch demo profile")).toHaveValue(
      "customer",
    );
    const ticket = (await page.context().cookies()).find(
      (cookie) => cookie.name === "ltr_demo_ticket",
    );
    expect(ticket?.httpOnly).toBe(true);
    const session = await service
      .from("demo_sessions")
      .select("workspace_id,customer_id")
      .eq(
        "token_hash",
        createHash("sha256").update(ticket!.value).digest("hex"),
      )
      .single();
    expect(session.error).toBeNull();
    customerId = session.data!.customer_id;
    const privateVendors = await service
      .from("vendors")
      .select("id")
      .eq("demo_workspace", session.data!.workspace_id);
    expect(privateVendors.error).toBeNull();
    const privateVendorIds = new Set(
      privateVendors.data!.map((vendor) => vendor.id),
    );
    expect(privateVendorIds.has(vendorId)).toBe(false);

    const showcase = page.getByRole("region", {
      name: "Participating local businesses",
      exact: true,
    });
    await expect(showcase).toBeVisible();
    await expect(showcase).toContainText("SHOWCASE ONLY");
    const business = showcase.locator("details").filter({ hasText: name });
    await expect(business).toHaveCount(1);
    const before = await customerRows();
    const sourceBefore = await sourceListing();
    expect(before).toEqual({ orders: [], cart: [], inquiries: [] });
    browserMutations.length = 0;
    await business.locator("summary").click();
    await expect(business).toHaveAttribute("open", "");
    await expect(business).toContainText(itemName);
    await expect(business).toContainText("$25.00");
    await expect(showcase).not.toContainText("LOCAL SHOWCASE INACTIVE ITEM");
    await expect(showcase).not.toContainText("LOCAL SHOWCASE PROHIBITED ITEM");
    await expect(showcase.locator("button")).toHaveCount(0);
    await expect(showcase.getByRole("link")).toHaveCount(0);
    await expect(showcase.locator("input, select, textarea, form")).toHaveCount(
      0,
    );
    expect(browserMutations).toEqual([]);
    expect(await customerRows()).toEqual(before);
    expect(await sourceListing()).toEqual(sourceBefore);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.locator(".explore-vendor-card").filter({ hasText: name }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: `${name} · approximate location`,
        exact: true,
      }),
    ).toHaveCount(0);

    const screenshot = info.outputPath("LOCAL-READONLY-VENDOR-SHOWCASE.png");
    await showcase.screenshot({ path: screenshot });
    await info.attach("LOCAL-READONLY-VENDOR-SHOWCASE", {
      path: screenshot,
      contentType: "image/png",
    });

    const assistant = await page.request.post("/api/assistant", {
      headers,
      data: { message: "Tell me about Handmade River Mug" },
    });
    expect(assistant.status()).toBe(200);
    const answer = await assistant.json();
    expect(answer.listings.length).toBeGreaterThan(0);
    expect(
      answer.listings.every((item: { vendorId: string }) =>
        privateVendorIds.has(item.vendorId),
      ),
    ).toBe(true);
    expect(
      answer.listings.map((item: { id: string }) => item.id),
    ).not.toContain(listingId);
    const denied = await page.request.post("/api/cart", {
      headers,
      data: { listingId, quantity: 1 },
    });
    expect(denied.status()).toBe(409);
    expect(await customerRows()).toEqual(before);
    expect(await sourceListing()).toEqual(sourceBefore);

    expect(
      (
        await service
          .from("vendors")
          .update({ active: false })
          .eq("id", vendorId)
      ).error,
    ).toBeNull();
    await page.reload();
    await expect(showcase).toBeVisible();
    await expect(showcase).not.toContainText(name);
    await expect(page.locator(".explore-vendor-card")).toHaveCount(
      privateVendorIds.size,
    );
    await expect(page.getByLabel("Switch demo profile")).toHaveValue(
      "customer",
    );
    expect(await customerRows()).toEqual(before);
    expect(await sourceListing()).toEqual(sourceBefore);
    expect(financialRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    if (
      (await page.context().cookies()).some(
        (cookie) => cookie.name === "ltr_demo_ticket",
      )
    )
      expect(
        (await page.request.delete("/api/demo", { headers })).status(),
      ).toBe(200);
    expect(
      (await service.from("listings").delete().eq("vendor_id", vendorId)).error,
    ).toBeNull();
    expect(
      (await service.from("vendors").delete().eq("id", vendorId)).error,
    ).toBeNull();
  }
});
