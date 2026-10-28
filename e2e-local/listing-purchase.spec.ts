import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  throw Error("Listing purchase fixtures require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const headers = { Origin: "http://127.0.0.1:3000" };
test.setTimeout(120000);
test.use({ actionTimeout: 15000 });
type Session = { workspace_id: string; customer_id: string };

async function enter(page: Page): Promise<Session> {
  expect(
    (await service.from("demo_entry_limits").delete().neq("key_hash", ""))
      .error,
  ).toBeNull();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Enter Demo Mode", exact: true })
    .click();
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
  await expect(page.getByLabel("Switch demo profile")).toHaveValue("customer");
  const ticket = (await page.context().cookies()).find(
    (cookie) => cookie.name === "ltr_demo_ticket",
  );
  expect(ticket?.httpOnly).toBe(true);
  const session = await service
    .from("demo_sessions")
    .select("workspace_id,customer_id")
    .eq("token_hash", createHash("sha256").update(ticket!.value).digest("hex"))
    .single();
  expect(session.error).toBeNull();
  expect(session.data!.workspace_id).not.toBe(templateWorkspace);
  return session.data!;
}

async function exitOwnedDemo(page: Page) {
  if (
    (await page.context().cookies()).some(
      (cookie) => cookie.name === "ltr_demo_ticket",
    )
  ) {
    const response = await page.request.delete("/api/demo", { headers });
    expect(response.status()).toBe(200);
  }
}

async function listing(workspace: string, title: string) {
  const result = await service
    .from("listings")
    .select(
      "id,vendor_id,title,inventory,price_cents,mode,vendors!inner(demo_workspace)",
    )
    .eq("title", title)
    .eq("vendors.demo_workspace", workspace)
    .single();
  expect(result.error).toBeNull();
  return result.data!;
}

async function businessRows(customer: string) {
  const [orders, cart] = await Promise.all([
    service
      .from("orders")
      .select(
        "id,state,customer_id,listing_id,vendor_id,quantity,total_cents,paypal_order_id,paypal_capture_id,runner_id",
      )
      .eq("customer_id", customer),
    service
      .from("cart_items")
      .select("listing_id,quantity")
      .eq("customer_id", customer),
  ]);
  expect(orders.error).toBeNull();
  expect(cart.error).toBeNull();
  const ledger = orders.data!.length
    ? await service
        .from("ledger")
        .select("id")
        .in(
          "order_id",
          orders.data!.map((order) => order.id),
        )
    : { data: [], error: null };
  expect(ledger.error).toBeNull();
  return { orders: orders.data!, cart: cart.data!, ledger: ledger.data! };
}

async function guardFinancialActions(page: Page) {
  const financial: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      /^\/api\/(checkout|capture|refunds|payments\/status|demo\/orders\/simulate)(\/|$)/.test(
        url.pathname,
      ) ||
      /(^|\.)paypal\.com$/.test(url.hostname)
    ) {
      financial.push(request.method() + " " + url.pathname);
      await route.abort();
    } else await route.continue();
  });
  return { financial, errors };
}

async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

const choose = (page: Page) =>
  page.getByRole("region", { name: "Choose this item", exact: true });

// Uses the actual shareable-page CTA rather than creating cart rows through an API fixture.
test("a bakery storefront listing adds two rolls to a persistent cart and prepares exactly one unpaid draft", async ({
  page,
}, info) => {
  const observed = await guardFinancialActions(page);
  try {
    const session = await enter(page);
    const rolls = await listing(
      session.workspace_id,
      "Habanero Cinnamon Rolls",
    );
    expect(Number(rolls.price_cents)).toBe(450);
    await page
      .getByRole("link", {
        name: "Visit Demo Hearth Bakery storefront",
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/vendors/${rolls.vendor_id}$`));
    await expect(
      page.getByRole("heading", {
        name: "Demo Hearth Bakery",
        level: 1,
        exact: true,
      }),
    ).toBeVisible();
    await page.getByRole("link", { name: /Habanero Cinnamon Rolls/ }).click();
    await expect(page).toHaveURL(new RegExp(`/listings/${rolls.id}$`));
    await expect(
      page.getByRole("heading", {
        name: "Habanero Cinnamon Rolls",
        level: 1,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "Choose this item in the marketplace",
        exact: true,
      }),
    ).toHaveCount(0);
    await choose(page).getByLabel("Quantity", { exact: true }).fill("2");
    await expect(
      choose(page).getByLabel("Selected item total", { exact: true }),
    ).toHaveText("$9.00");
    await noOverflow(page);
    const added = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/cart" &&
        response.request().method() === "POST",
    );
    await choose(page)
      .getByRole("button", { name: "Add to cart", exact: true })
      .click();
    const addedResponse = await added;
    expect(addedResponse.status()).toBe(200);
    expect(addedResponse.request().postDataJSON()).toEqual({
      listingId: rolls.id,
      quantity: 2,
    });
    await expect(page).toHaveURL(/\/cart$/);
    await page.reload();
    const cart = page.locator(".simple-card").filter({
      has: page.getByRole("heading", {
        name: "Demo Hearth Bakery",
        exact: true,
      }),
    });
    await expect(cart).toContainText("2 × $4.50");
    await expect(cart).toContainText("Total $9.00");
    await expect(
      page.getByLabel("Delivery address", { exact: true }),
    ).toHaveValue(/DEMO TEST ADDRESS/);
    const beforePreparation = await businessRows(session.customer_id);
    expect(beforePreparation.cart).toEqual([
      { listing_id: rolls.id, quantity: 2 },
    ]);
    expect(beforePreparation.orders).toHaveLength(0);
    expect(beforePreparation.ledger).toHaveLength(0);
    expect((await listing(session.workspace_id, rolls.title)).inventory).toBe(
      rolls.inventory,
    );
    const screenshot = info.outputPath("LOCAL-LISTING-cart-two-rolls.png");
    await page.screenshot({ path: screenshot, fullPage: true });
    await info.attach("LOCAL-LISTING-cart-two-rolls", {
      path: screenshot,
      contentType: "image/png",
    });
    const prepared = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/cart" &&
        response.request().method() === "PUT",
    );
    await cart
      .getByRole("button", { name: "Prepare this vendor order", exact: true })
      .click();
    const preparedResponse = await prepared;
    expect(preparedResponse.status()).toBe(200);
    const order = (await preparedResponse.json()).order;
    await expect(page).toHaveURL(
      new RegExp(`/dashboard[?]prepared=${order.id}$`),
    );
    await expect(
      page.getByRole("heading", { name: "$9.00 · DRAFT", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "$9.00 · DRAFT", exact: true }),
    ).toBeVisible();
    const after = await businessRows(session.customer_id);
    expect(after.orders).toHaveLength(1);
    expect(after.orders[0]).toMatchObject({
      id: order.id,
      customer_id: session.customer_id,
      listing_id: rolls.id,
      vendor_id: rolls.vendor_id,
      quantity: 2,
      state: "DRAFT",
      paypal_order_id: null,
      paypal_capture_id: null,
      runner_id: null,
    });
    expect(Number(after.orders[0].total_cents)).toBe(900);
    expect(after.cart).toHaveLength(0);
    expect(after.ledger).toHaveLength(0);
    expect((await listing(session.workspace_id, rolls.title)).inventory).toBe(
      rolls.inventory - 2,
    );
    await noOverflow(page);
    expect(observed.financial).toEqual([]);
    expect(observed.errors).toEqual([]);
  } finally {
    await exitOwnedDemo(page);
  }
});

test("listing actions explain guest and non-customer access while customer quotes create only an inquiry", async ({
  page,
}) => {
  const observed = await guardFinancialActions(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      ["/api/cart", "/api/orders", "/api/inquiries"].includes(path) &&
      request.method() !== "GET"
    )
      writes.push(request.method() + " " + path);
  });
  try {
    const publicRolls = await listing(
      templateWorkspace,
      "Habanero Cinnamon Rolls",
    );
    await page.goto(`/listings/${publicRolls.id}`);
    await expect(choose(page)).toContainText("Sign in as a customer");
    await expect(
      choose(page).getByRole("link", { name: "Sign in to shop", exact: true }),
    ).toHaveAttribute("href", "/login");
    await expect(choose(page).getByRole("button")).toHaveCount(0);
    expect(writes).toEqual([]);
    const session = await enter(page);
    const sign = await listing(session.workspace_id, "Custom House Sign");
    const rolls = await listing(
      session.workspace_id,
      "Habanero Cinnamon Rolls",
    );
    for (const role of ["vendor", "runner"]) {
      await page.getByLabel("Switch demo profile").selectOption(role);
      await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
      await expect(page.getByLabel("Switch demo profile")).toHaveValue(role);
      await page.goto(`/listings/${rolls.id}`);
      await expect(choose(page)).toContainText(
        /Switch to the Customer demo profile/,
      );
      await expect(choose(page).getByRole("button")).toHaveCount(0);
      await noOverflow(page);
    }
    expect(writes).toEqual([]);
    await page.getByLabel("Switch demo profile").selectOption("customer");
    await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
    await expect(page.getByLabel("Switch demo profile")).toHaveValue(
      "customer",
    );
    await page.goto(`/listings/${sign.id}`);
    await expect(
      choose(page).getByLabel("Quantity", { exact: true }),
    ).toHaveCount(0);
    await expect(
      choose(page).getByRole("button", { name: "Add to cart", exact: true }),
    ).toHaveCount(0);
    const message =
      "Fictional demo inquiry: can you make a small wooden house sign?";
    await choose(page)
      .getByLabel("Quote request", { exact: true })
      .fill(message);
    const submitted = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/inquiries" &&
        response.request().method() === "POST",
    );
    await choose(page)
      .getByRole("button", { name: "Request a quote", exact: true })
      .click();
    const response = await submitted;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({
      listingId: sign.id,
      message,
    });
    await expect(choose(page).getByRole("status")).toContainText(
      "No order or payment was created.",
    );
    await expect(
      choose(page).getByRole("button", {
        name: "Quote request sent",
        exact: true,
      }),
    ).toBeDisabled();
    const inquiries = await service
      .from("inquiries")
      .select("listing_id,message,status")
      .eq("customer_id", session.customer_id);
    expect(inquiries.error).toBeNull();
    expect(inquiries.data).toEqual([
      { listing_id: sign.id, message, status: "OPEN" },
    ]);
    const after = await businessRows(session.customer_id);
    expect(after.cart).toHaveLength(0);
    expect(after.orders).toHaveLength(0);
    expect(after.ledger).toHaveLength(0);
    expect(writes).toEqual(["POST /api/inquiries"]);
    await choose(page)
      .getByRole("link", { name: /View quote inquiries/ })
      .click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator("main:not([role=status])")).toContainText(
      message,
    );
    await noOverflow(page);
    expect(observed.financial).toEqual([]);
    expect(observed.errors).toEqual([]);
  } finally {
    await exitOwnedDemo(page);
  }
});

test("a stale listing quantity shows a retryable conflict and cart updates remain one row without reserving stock", async ({
  page,
}) => {
  const observed = await guardFinancialActions(page);
  let ownListing:
    { id: string; vendor_id: string; inventory: number } | undefined;
  let stockChanged = false;
  try {
    const session = await enter(page);
    const rolls = await listing(
      session.workspace_id,
      "Habanero Cinnamon Rolls",
    );
    ownListing = rolls;
    await page.goto(`/listings/${rolls.id}`);
    await choose(page).getByLabel("Quantity", { exact: true }).fill("2");
    // Mutate only this new, non-template LOCAL workspace after the browser read.
    const changed = await service
      .from("listings")
      .update({ inventory: 1 })
      .eq("id", rolls.id)
      .eq("vendor_id", rolls.vendor_id)
      .eq("inventory", rolls.inventory)
      .select("id")
      .single();
    expect(changed.error).toBeNull();
    stockChanged = true;
    const rejected = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/cart" &&
        response.request().method() === "POST",
    );
    await choose(page)
      .getByRole("button", { name: "Add to cart", exact: true })
      .click();
    expect((await rejected).status()).toBe(409);
    await expect(choose(page).getByRole("alert")).toBeVisible();
    await expect(
      choose(page).getByLabel("Quantity", { exact: true }),
    ).toHaveValue("2");
    await expect(
      choose(page).getByRole("button", { name: "Add to cart", exact: true }),
    ).toBeEnabled();
    const empty = await businessRows(session.customer_id);
    expect(empty.cart).toHaveLength(0);
    expect(empty.orders).toHaveLength(0);
    const restored = await service
      .from("listings")
      .update({ inventory: rolls.inventory })
      .eq("id", rolls.id)
      .eq("vendor_id", rolls.vendor_id)
      .eq("inventory", 1)
      .select("id")
      .single();
    expect(restored.error).toBeNull();
    stockChanged = false;
    const retried = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/cart" &&
        response.request().method() === "POST",
    );
    await choose(page)
      .getByRole("button", { name: "Add to cart", exact: true })
      .click();
    expect((await retried).status()).toBe(200);
    await expect(page).toHaveURL(/\/cart$/);
    await page.goto(`/listings/${rolls.id}`);
    await expect(
      choose(page).getByLabel("Quantity", { exact: true }),
    ).toHaveValue("2");
    await choose(page).getByLabel("Quantity", { exact: true }).fill("1");
    const updated = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/cart" &&
        response.request().method() === "POST",
    );
    await choose(page)
      .getByRole("button", { name: "Update cart", exact: true })
      .click();
    expect((await updated).status()).toBe(200);
    await expect(page).toHaveURL(/\/cart$/);
    await page.reload();
    await expect(page.locator(".cart-line")).toContainText("1 × $4.50");
    const after = await businessRows(session.customer_id);
    expect(after.cart).toEqual([{ listing_id: rolls.id, quantity: 1 }]);
    expect(after.orders).toHaveLength(0);
    expect(after.ledger).toHaveLength(0);
    expect((await listing(session.workspace_id, rolls.title)).inventory).toBe(
      rolls.inventory,
    );
    await noOverflow(page);
    expect(observed.financial).toEqual([]);
    expect(observed.errors).toEqual([]);
  } finally {
    if (stockChanged && ownListing) {
      const restored = await service
        .from("listings")
        .update({ inventory: ownListing.inventory })
        .eq("id", ownListing.id)
        .eq("vendor_id", ownListing.vendor_id)
        .eq("inventory", 1);
      expect(restored.error).toBeNull();
    }
    await exitOwnedDemo(page);
  }
});
