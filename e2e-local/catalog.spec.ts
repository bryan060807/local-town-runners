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
// Catalog fixtures only touch the fresh, isolated demo in the local backend.
if (env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321")
  throw Error("Catalog fixtures require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
test.setTimeout(120000);
test.use({ actionTimeout: 15000 });

test("vendor catalog stays compact and searchable while listing changes persist", async ({
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
    .select("workspace_id")
    .eq("token_hash", createHash("sha256").update(ticket.value).digest("hex"))
    .single();
  expect(session.error).toBeNull();
  const vendor = await service
    .from("vendors")
    .select("id")
    .eq("demo_workspace", session.data!.workspace_id)
    .eq("name", "Riverbend Market & Goods")
    .single();
  expect(vendor.error).toBeNull();
  const title = "ZZ Catalog Fixture Active";
  const inserted = await service.from("listings").insert([
    {
      vendor_id: vendor.data!.id,
      title,
      category: "Gifts",
      mode: "SELL",
      price_cents: 1999,
      inventory: 7,
      active: true,
    },
    {
      vendor_id: vendor.data!.id,
      title: "ZZ Catalog Fixture Inactive",
      category: "Food",
      mode: "SELL",
      price_cents: 888,
      inventory: 8,
      active: false,
    },
    {
      vendor_id: vendor.data!.id,
      title: "ZZ Catalog Fixture Sold Out",
      category: "Makers",
      mode: "SELL",
      price_cents: 777,
      inventory: 0,
      active: true,
    },
  ]);
  expect(inserted.error).toBeNull();

  await page.getByLabel("Switch demo profile").selectOption("vendor");
  await expect(
    page.getByRole("heading", { name: "Hello, Riverbend Market & Goods." }),
  ).toBeVisible();
  const catalog = page.locator(".vendor-catalog");
  const rows = catalog.locator(".vendor-catalog-row");
  await catalog
    .getByRole("combobox", { name: "Storefront", exact: true })
    .selectOption({ label: "Riverbend Market & Goods" });
  await expect(rows).toHaveCount(10);
  await expect(
    catalog.getByRole("button", { name: "Save listing" }),
  ).toHaveCount(0);
  await catalog.getByRole("button", { name: "Next page", exact: true }).click();
  await expect(rows).toHaveCount(3);
  await catalog
    .getByRole("button", { name: "Previous page", exact: true })
    .click();
  await expect(rows).toHaveCount(10);

  const search = catalog.getByRole("searchbox", {
    name: "Search your catalog",
  });
  await search.fill("ZZ Catalog Fixture");
  await expect(rows).toHaveCount(3);
  const sort = catalog.getByRole("combobox", {
    name: "Sort listings",
    exact: true,
  });
  await sort.selectOption("price");
  await expect(rows.first()).toContainText("ZZ Catalog Fixture Sold Out");
  await expect(rows.last()).toContainText(title);
  await sort.selectOption("stock");
  await expect(rows.first()).toContainText("ZZ Catalog Fixture Sold Out");
  await expect(rows.last()).toContainText("ZZ Catalog Fixture Inactive");
  await sort.selectOption("name");
  await catalog
    .getByRole("combobox", { name: "Listing status", exact: true })
    .selectOption({ label: "Inactive" });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("ZZ Catalog Fixture Inactive");
  await catalog
    .getByRole("combobox", { name: "Listing status", exact: true })
    .selectOption({ label: "Out of stock" });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("ZZ Catalog Fixture Sold Out");
  await catalog
    .getByRole("combobox", { name: "Listing status", exact: true })
    .selectOption({ label: "All listings" });
  await catalog
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption({ label: "Food" });
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("ZZ Catalog Fixture Inactive");
  await search.fill("no matching item here");
  await expect(rows).toHaveCount(0);
  await catalog
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(search).toHaveValue("");
  await expect(rows).toHaveCount(10);

  await search.fill(title);
  await expect(rows).toHaveCount(1);
  await catalog
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  const editor = catalog.locator("form").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  });
  await editor.getByLabel("Available inventory").fill("6");
  await editor.getByLabel("Price in cents").fill("1234");
  await catalog
    .getByRole("button", { name: `Close editor for ${title}`, exact: true })
    .click();
  await catalog
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await expect(editor.getByLabel("Available inventory")).toHaveValue("6");
  await expect(editor.getByLabel("Price in cents")).toHaveValue("1234");
  // Exercise a genuinely in-flight UI request without writing failure fixtures
  // to the backend. The successful request below still uses the real local API.
  let releaseFailure!: () => void;
  let requestReceived!: () => void;
  const delayedFailure = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  const received = new Promise<void>((resolve) => {
    requestReceived = resolve;
  });
  await page.route("**/api/vendor", async (route) => {
    requestReceived();
    await delayedFailure;
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Catalog test: please try again." }),
    });
  });
  const rejected = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/vendor") && response.status() === 503,
  );
  await editor
    .getByRole("button", { name: "Save listing", exact: true })
    .click();
  await received;
  await catalog
    .getByRole("button", { name: `Close editor for ${title}`, exact: true })
    .click();
  await catalog
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await expect(
    editor.getByRole("button", { name: "Saving…", exact: true }),
  ).toBeDisabled();
  releaseFailure();
  expect((await rejected).status()).toBe(503);
  await expect(editor.getByRole("status").last()).toContainText(
    "Catalog test: please try again.",
  );
  await catalog
    .getByRole("button", { name: `Close editor for ${title}`, exact: true })
    .click();
  await catalog
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await expect(editor.getByRole("status").last()).toContainText(
    "Catalog test: please try again.",
  );
  await expect(rows).toContainText("$19.99");
  await expect(editor.getByLabel("Available inventory")).toHaveValue("6");
  await expect(editor.getByLabel("Price in cents")).toHaveValue("1234");
  await page.unroute("**/api/vendor");
  const save = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/vendor") &&
      response.request().method() === "POST",
  );
  await editor
    .getByRole("button", { name: "Save listing", exact: true })
    .click();
  expect((await save).status()).toBe(200);
  await expect(editor.getByRole("status").last()).toContainText(
    "Listing updated",
  );
  await expect(rows).toContainText("$12.34");
  await catalog
    .getByRole("button", { name: `Close editor for ${title}`, exact: true })
    .click();
  await expect(
    catalog.getByRole("button", { name: "Save listing" }),
  ).toHaveCount(0);
  await catalog
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(rows).toHaveCount(10);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const compact = info.outputPath("vendor-catalog-compact.png");
  await catalog.screenshot({ path: compact });
  await info.attach("vendor-catalog-compact", {
    path: compact,
    contentType: "image/png",
  });

  await page.reload();
  await search.fill(title);
  await expect(rows).toContainText("$12.34");
  await catalog
    .getByRole("button", { name: `Edit ${title}`, exact: true })
    .click();
  await expect(editor.getByLabel("Available inventory")).toHaveValue("6");
  await expect(editor.getByLabel("Price in cents")).toHaveValue("1234");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const expanded = info.outputPath("vendor-catalog-editor.png");
  await catalog.screenshot({ path: expanded });
  await info.attach("vendor-catalog-editor", {
    path: expanded,
    contentType: "image/png",
  });
  expect(pageErrors).toEqual([]);
  const exited = await page.request.delete("/api/demo", {
    headers: { Origin: "http://127.0.0.1:3000" },
  });
  expect(exited.status()).toBe(200);
});
