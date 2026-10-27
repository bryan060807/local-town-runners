import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
if (env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321")
  throw Error("Explore fixtures require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
test.setTimeout(90000);
test.use({ actionTimeout: 15000 });

test("Explore highlights vendors, bounds featured items and keeps every available item reachable", async ({
  page,
  context,
}, info) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await service.from("demo_entry_limits").delete().neq("key_hash", "");
  await page.goto("/");
  await page.getByRole("button", { name: "Enter Demo Mode" }).click();
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
  const ticket = (await context.cookies()).find(
    (cookie) => cookie.name === "ltr_demo_ticket",
  )!;
  const session = await service
    .from("demo_sessions")
    .select("workspace_id,vendor_id")
    .eq("token_hash", createHash("sha256").update(ticket.value).digest("hex"))
    .single();
  expect(session.error).toBeNull();
  const inserted = await service.from("vendors").insert(
    [1, 2, 3].map((number) => ({
      owner_id: session.data!.vendor_id,
      name: `ZZ Explore Neighbor ${number}`,
      slug: `zz-explore-${session.data!.workspace_id}-${number}`,
      description:
        "Fictional local browser directory fixture; no goods for sale.",
      category: "Gifts",
      public_lon: -91.05,
      public_lat: 39.45,
      active: true,
    })),
  );
  expect(inserted.error).toBeNull();
  const vendors = await service
    .from("vendors")
    .select("id")
    .eq("demo_workspace", session.data!.workspace_id);
  expect(vendors.error).toBeNull();
  const available = await service
    .from("listings")
    .select("title")
    .in(
      "vendor_id",
      vendors.data!.map((vendor) => vendor.id),
    )
    .eq("active", true)
    .eq("prohibited", false)
    .gt("inventory", 0);
  expect(available.error).toBeNull();
  expect(available.data).toHaveLength(25);
  await page.reload();

  const directory = page.locator(".vendor-directory");
  const vendorCards = directory.locator(".explore-vendor-card");
  const products = page.locator(".cards .product");
  await expect(vendorCards).toHaveCount(6);
  await expect(products).toHaveCount(4);
  await expect(vendorCards.first()).toContainText(
    "No completed-order reviews yet",
  );
  await expect(
    directory.getByText("Community favorite", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show more vendors", exact: true })
    .click();
  await expect(vendorCards).toHaveCount(7);
  if ((page.viewportSize()?.width || 1280) <= 760) {
    const rail = page.getByRole("region", { name: "Vendor storefront cards" });
    expect(
      await rail.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    await rail
      .getByRole("link", { name: "Visit ZZ Explore Neighbor 3 storefront" })
      .focus();
    await expect
      .poll(() => rail.evaluate((element) => element.scrollLeft))
      .toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await rail.evaluate((element) => element.scrollTo({ left: 0 }));
  }
  await page
    .getByRole("button", { name: "Show fewer vendors", exact: true })
    .click();
  await expect(vendorCards).toHaveCount(6);
  const screenshot = info.outputPath("explore-vendor-directory.png");
  await directory.screenshot({ path: screenshot });
  await info.attach("explore-vendor-directory", {
    path: screenshot,
    contentType: "image/png",
  });

  await page
    .getByRole("button", { name: "Browse all items", exact: true })
    .click();
  const discovered: string[] = [];
  const next = page.getByRole("button", { name: "Next items", exact: true });
  for (const count of [12, 12, 1]) {
    await expect(products).toHaveCount(count);
    const titles = await products.locator("h3").allTextContents();
    discovered.push(...titles);
    if (discovered.length < 25) {
      await expect(next).toBeEnabled();
      await next.click();
      await expect(products.first().locator("h3")).not.toHaveText(titles[0]);
    }
  }
  await expect(next).toBeDisabled();
  expect(discovered.sort()).toEqual(
    available.data!.map((listing) => listing.title).sort(),
  );
  expect(new Set(discovered).size).toBe(25);
  await page
    .getByRole("button", { name: "Previous items", exact: true })
    .click();
  await expect(products).toHaveCount(12);
  await page
    .getByRole("button", { name: "Back to featured finds", exact: true })
    .click();
  await expect(products).toHaveCount(4);

  const search = page.getByRole("textbox", { name: "Search listings" });
  await search.fill("ZZ Explore Neighbor 3");
  await expect(vendorCards).toHaveCount(1);
  await expect(vendorCards).toContainText("ZZ Explore Neighbor 3");
  await expect(vendorCards).toContainText("No available finds right now");
  await expect(products).toHaveCount(0);
  await search.fill("Handmade River Mug");
  await expect(products).toHaveCount(1);
  await expect(products).toContainText("Handmade River Mug");
  // A searched directory remounts with six cards. Database row order is not
  // a ranking contract, so find the intended vendor instead of assuming its
  // card is in that first group.
  await search.fill("Riverbend Market & Goods");
  await expect(vendorCards).toHaveCount(1);
  await page
    .getByRole("button", {
      name: "Browse Riverbend Market & Goods items",
      exact: true,
    })
    .click();
  await expect(products).toHaveCount(10);
  await expect(vendorCards).toHaveCount(1);
  await page
    .getByRole("button", { name: "Show all vendors", exact: true })
    .click();
  await expect(products).toHaveCount(4);
  await search.fill("Riverbend Market & Goods");
  await expect(vendorCards).toHaveCount(1);
  await page
    .getByRole("link", {
      name: "Visit Riverbend Market & Goods storefront",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Riverbend Market & Goods",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator("main:not([role=status])")).toContainText(
    "No completed-order reviews yet",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(pageErrors).toEqual([]);
  const exited = await page.request.delete("/api/demo", {
    headers: { Origin: "http://127.0.0.1:3000" },
  });
  expect(exited.status()).toBe(200);
});
