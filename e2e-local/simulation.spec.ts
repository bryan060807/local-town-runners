import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  (await readFile(".local-backend/app.env", "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
if (env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321")
  throw Error(
    "Simulation browser fixtures require the dedicated local backend",
  );
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const origin = "http://127.0.0.1:3000";
const headers = { Origin: origin };
const endpoint = "/api/demo/orders/simulate";
test.setTimeout(120000);
test.use({ actionTimeout: 15000 });

async function enter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter Demo Mode" }).click();
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
}

async function switchRole(context: BrowserContext, role: string) {
  const result = await context.request.post("/api/demo", {
    headers,
    data: { role },
  });
  expect(result.status()).toBe(200);
}

test("simulation requires its private customer ticket and can be declined without a PayPal refund", async ({
  browser,
  page,
  context,
}, info) => {
  await service.from("demo_entry_limits").delete().neq("key_hash", "");
  const deniedAnonymous = await page.request.post(endpoint, {
    headers,
    data: { orderId: randomUUID() },
  });
  expect(deniedAnonymous.status()).toBe(401);
  await enter(page);
  const storage = await context.storageState();
  const ticket = (await context.cookies()).find(
    (cookie) => cookie.name === "ltr_demo_ticket",
  )!;
  const tokenHash = createHash("sha256").update(ticket.value).digest("hex");
  const session = await service
    .from("demo_sessions")
    .select("workspace_id,customer_id")
    .eq("token_hash", tokenHash)
    .single();
  expect(session.error).toBeNull();
  const listing = await service
    .from("listings")
    .select("id,inventory,price_cents,vendor_id,vendors!inner(demo_workspace)")
    .eq("vendors.demo_workspace", session.data!.workspace_id)
    .eq("mode", "SELL")
    .eq("active", true)
    .gt("inventory", 2)
    .limit(1)
    .single();
  expect(listing.error).toBeNull();
  const prepared = await page.request.post("/api/orders", {
    headers,
    data: {
      listingId: listing.data!.id,
      quantity: 1,
      requestId: randomUUID(),
      deliveryAddress:
        "DEMO TEST ADDRESS — isolated simulation browser fixture",
    },
  });
  expect(prepared.status()).toBe(200);
  const order = (await prepared.json()).order;
  const requestData = { orderId: order.id };
  expect(
    (
      await page.request.post(endpoint, {
        headers: { Origin: "https://untrusted.invalid" },
        data: requestData,
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await page.request.post(endpoint, {
        headers,
        data: { ...requestData, workspaceId: session.data!.workspace_id },
      })
    ).status(),
  ).toBe(400);

  const other = await browser.newContext({ baseURL: origin });
  const missingTicket = await browser.newContext({
    baseURL: origin,
    storageState: storage,
  });
  const mismatchedTicket = await browser.newContext({
    baseURL: origin,
    storageState: storage,
  });
  const realAccount = await browser.newContext({ baseURL: origin });
  try {
    await missingTicket.clearCookies({ name: "ltr_demo_ticket" });
    expect(
      (
        await missingTicket.request.post(endpoint, {
          headers,
          data: requestData,
        })
      ).status(),
    ).toBe(403);

    const otherPage = await other.newPage();
    await enter(otherPage);
    expect(
      (
        await other.request.post(endpoint, {
          headers,
          data: requestData,
        })
      ).status(),
    ).toBe(403);
    const otherTicket = (await other.cookies()).find(
      (cookie) => cookie.name === "ltr_demo_ticket",
    )!;
    await mismatchedTicket.addCookies([{ ...otherTicket }]);
    expect(
      (
        await mismatchedTicket.request.post(endpoint, {
          headers,
          data: requestData,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await other.request.post("/api/demo/orders/cancel", {
          headers,
          data: requestData,
        })
      ).status(),
    ).toBe(403);

    const realPage = await realAccount.newPage();
    await realPage.goto("/login");
    await realPage
      .getByLabel("Email", { exact: true })
      .fill("customer@local-town-runners.example");
    await realPage
      .getByLabel("Password", { exact: true })
      .fill(env.DEMO_SEED_PASSWORD);
    await realPage
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(realPage).toHaveURL(/\/dashboard/);
    await expect(
      realPage.getByRole("button", {
        name: "Simulate demo payment",
        exact: true,
      }),
    ).toHaveCount(0);
    expect(
      (
        await realAccount.request.post(endpoint, {
          headers,
          data: requestData,
        })
      ).status(),
    ).toBe(403);

    for (const role of ["vendor", "runner"]) {
      await switchRole(context, role);
      expect(
        (
          await context.request.post(endpoint, {
            headers,
            data: requestData,
          })
        ).status(),
      ).toBe(403);
    }
    const unchanged = await service
      .from("orders")
      .select(
        "state,customer_id,demo_simulated,paypal_order_id,paypal_capture_id",
      )
      .eq("id", order.id)
      .single();
    expect(unchanged.error).toBeNull();
    expect(unchanged.data).toEqual({
      state: "DRAFT",
      customer_id: session.data!.customer_id,
      demo_simulated: false,
      paypal_order_id: null,
      paypal_capture_id: null,
    });
    const untouchedLedger = await service
      .from("ledger")
      .select("id")
      .eq("order_id", order.id);
    expect(untouchedLedger.error).toBeNull();
    expect(untouchedLedger.data).toHaveLength(0);
    await switchRole(context, "customer");
    await page.goto("/dashboard");
    const card = page.locator(".simple-card").filter({
      hasText: `Order ${order.id} · Quantity 1`,
    });
    await card
      .getByRole("button", { name: "Simulate demo payment", exact: true })
      .click();
    await expect(card).toContainText("PAID");
    await expect(card).toContainText("SIMULATED DEMO ORDER — NO PAYPAL CHARGE");
    for (const path of [
      "/api/checkout",
      "/api/capture",
      "/api/payments/status",
      "/api/refunds",
    ]) {
      const blocked = await page.request.post(path, {
        headers,
        data: requestData,
      });
      expect(blocked.status(), path).toBe(409);
    }
    expect(
      (
        await page.request.post("/api/demo/orders/cancel", {
          headers,
          data: requestData,
        })
      ).status(),
    ).toBe(403);

    await page.getByLabel("Switch demo profile").selectOption("vendor");
    await expect(
      page.getByRole("heading", { name: "Hello, Riverbend Market & Goods." }),
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Decline and refund Sandbox payment" }),
    ).toHaveCount(0);
    const cancellation = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/demo/orders/cancel") &&
        response.request().method() === "POST",
    );
    await card
      .getByRole("button", { name: "Cancel simulated order", exact: true })
      .click();
    expect((await cancellation).status()).toBe(200);
    await expect(card).toContainText("CANCELLED");
    await expect(card).toContainText("SIMULATED DEMO ORDER — NO PAYPAL CHARGE");
    expect(
      (
        await page.request.post("/api/demo/orders/cancel", {
          headers,
          data: requestData,
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await page.request.post("/api/refunds", {
          headers,
          data: requestData,
        })
      ).status(),
    ).toBe(409);
    const current = await service
      .from("orders")
      .select(
        "state,demo_simulated,paypal_order_id,paypal_capture_id,paypal_refund_id,refund_state",
      )
      .eq("id", order.id)
      .single();
    expect(current.error).toBeNull();
    expect(current.data).toEqual({
      state: "CANCELLED",
      demo_simulated: true,
      paypal_order_id: null,
      paypal_capture_id: null,
      paypal_refund_id: null,
      refund_state: "NONE",
    });
    const restored = await service
      .from("listings")
      .select("inventory")
      .eq("id", listing.data!.id)
      .single();
    expect(restored.error).toBeNull();
    expect(restored.data!.inventory).toBe(listing.data!.inventory);
    const ledger = await service
      .from("ledger")
      .select("kind,simulated")
      .eq("order_id", order.id);
    expect(ledger.error).toBeNull();
    expect(ledger.data).toHaveLength(4);
    expect(
      ledger.data?.filter((entry) => entry.kind === "DEMO_PAYMENT"),
    ).toHaveLength(1);
    expect(ledger.data?.every((entry) => entry.simulated)).toBe(true);
    const paymentEvents = await service
      .from("payment_events")
      .select("event_id")
      .eq("order_id", order.id);
    expect(paymentEvents.error).toBeNull();
    expect(paymentEvents.data).toHaveLength(0);
    await expect(
      page.locator(".payment-summary .balance-grid strong"),
    ).toHaveText(["$0.00", "$0.00", "$0.00"]);
    await missingTicket.addCookies([{ ...ticket }]);
    await expect(page.locator("main:not([role=status])")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const screenshot = info.outputPath(
      "SIMULATED-DEMO-vendor-cancellation.png",
    );
    await page.screenshot({ path: screenshot, fullPage: true });
    await info.attach("SIMULATED-DEMO-vendor-cancellation", {
      path: screenshot,
      contentType: "image/png",
    });

    expect(
      (
        await service
          .from("demo_sessions")
          .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
          .eq("token_hash", tokenHash)
      ).error,
    ).toBeNull();
    expect(
      (
        await page.request.post("/api/demo/orders/cancel", {
          headers,
          data: requestData,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await missingTicket.request.post(endpoint, {
          headers,
          data: requestData,
        })
      ).status(),
    ).toBe(403);
  } finally {
    await context.request.delete("/api/demo", { headers });
    await other.request.delete("/api/demo", { headers });
    await Promise.all([
      other.close(),
      missingTicket.close(),
      mismatchedTicket.close(),
      realAccount.close(),
    ]);
  }
});
