import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
const env = Object.fromEntries(
  (await readFile(".local-backend/app.env", "utf8"))
    .trim()
    .split("\n")
    .map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i), x.slice(i + 1)];
    }),
);
if (env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:54321")
  throw Error("Demo tests require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
);
test.setTimeout(60000);
const headers = { Origin: "http://127.0.0.1:3000" };
test("isolated demo switches real sessions; cart, quotes and fulfillment persist at every viewport", async ({
  page,
  context,
}) => {
  await service.from("demo_entry_limits").delete().neq("key_hash", "");
  await page.goto("/");
  await page.getByRole("button", { name: "Enter Demo Mode" }).click();
  await expect(page.getByLabel("Switch demo profile")).toBeVisible({
    timeout: 30000,
  });
  const status = await page.request.get("/api/demo");
  expect((await status.json()).role).toBe("customer");
  const tickets = await context.cookies();
  expect(tickets.find((x) => x.name === "ltr_demo_ticket")?.httpOnly).toBe(
    true,
  );
  const ticket = tickets.find((x) => x.name === "ltr_demo_ticket")!.value;
  const { createHash } = await import("node:crypto");
  const session = await service
    .from("demo_sessions")
    .select("workspace_id,customer_id,vendor_id,runner_id")
    .eq("token_hash", createHash("sha256").update(ticket).digest("hex"))
    .single();
  expect(session.error).toBeNull();
  const vendors = await service
    .from("vendors")
    .select("id")
    .eq("demo_workspace", session.data!.workspace_id)
    .eq("name", "Riverbend Market & Goods")
    .single();
  const listings = await service
    .from("listings")
    .select("*")
    .eq("vendor_id", vendors.data!.id)
    .order("title");
  expect(listings.data).toHaveLength(10);
  await expect(
    page.getByRole("heading", {
      name: "Riverbend Market & Goods",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Fictional Riverbend storefront illustration",
    }),
  ).toBeVisible();
  for (const item of listings.data!.slice(0, 2)) {
    const r = await page.request.post("/api/cart", {
      headers,
      data: { listingId: item.id, quantity: 1 },
    });
    expect(r.status(), await r.text()).toBe(200);
  }
  await page.goto("/cart");
  await expect(page.locator("main:not([role=status])")).toContainText(
    "Riverbend Market & Goods",
  );
  await expect(page.getByLabel("Delivery address")).toHaveValue(/DEMO/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  expect(overflow).toBe(false);
  const preparation = page.waitForResponse(
    (r) => r.url().endsWith("/api/cart") && r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Prepare this vendor order" }).click();
  const prepared = await preparation;
  expect(prepared.status(), await prepared.text()).toBe(200);
  const order = (await prepared.json()).order;
  expect(Number(order.total_cents)).toBe(
    listings.data!.slice(0, 2).reduce((a, x) => a + x.price_cents, 0),
  );
  const checkout = await page.request.post("/api/checkout", {
    headers,
    data: { orderId: order.id },
  });
  expect(checkout.status()).toBe(503);
  const current = await service
    .from("orders")
    .select("state")
    .eq("id", order.id)
    .single();
  expect(current.data!.state).toBe("DRAFT");
  // DB-only verified capture fixture for fulfillment tests; never presented as a real PayPal result.
  expect(
    (
      await service.rpc("attach_verified_paypal_order", {
        order_id: order.id,
        paypal_id: "LOCAL-TEST-" + order.id,
        customer_id: session.data!.customer_id,
      })
    ).error,
  ).toBeNull();
  expect(
    (
      await service.rpc("confirm_payment", {
        order_id: order.id,
        capture_id: "LOCAL-TEST-" + order.id,
        event_id: "LOCAL-TEST-" + order.id,
        amount_cents: order.total_cents,
      })
    ).error,
  ).toBeNull();
  const deniedRefund = await page.request.post("/api/refunds", {
    headers,
    data: { orderId: order.id },
  });
  expect(deniedRefund.status()).toBe(403);
  await page.goto("/dashboard");
  await page.getByLabel("Switch demo profile").selectOption("vendor");
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Hello, Riverbend Market & Goods." }),
  ).toBeVisible();
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
  const edited = listings.data![2];
  const editor = page
    .locator("form")
    .filter({
      has: page.getByRole("heading", { name: edited.title, exact: true }),
    });
  await editor.getByLabel("Available inventory").fill("9");
  await editor.getByLabel("Price in cents").fill("1234");
  const editResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/vendor") && r.request().method() === "POST",
  );
  await editor
    .getByRole("button", { name: "Save listing", exact: true })
    .click();
  expect((await editResponse).status()).toBe(200);
  await expect(editor.getByRole("status").last()).toContainText(
    "Listing updated",
  );
  const forbidden = await page.request.post("/api/demo", {
    headers,
    data: { role: "admin", userId: session.data!.customer_id },
  });
  expect(forbidden.status()).toBe(400);
  for (const state of ["VENDOR_ACCEPTED", "RUNNER_MATCHING"])
    expect(
      (
        await page.request.post("/api/fulfillment", {
          headers,
          data: { orderId: order.id, state },
        })
      ).status(),
    ).toBe(200);
  await page.getByLabel("Switch demo profile").selectOption("runner");
  await expect(
    page.getByRole("heading", { name: "Hello, Jordan Ellis." }),
  ).toBeVisible();
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
  await page
    .getByRole("link", { name: "View your public runner profile →" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Jordan Ellis", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main:not([role=status])")).toContainText(
    "FICTIONAL DEMO RUNNER",
  );
  await page.goto("/dashboard");
  const accept = await page.request.post("/api/runner", {
    headers,
    data: { action: "accept", orderId: order.id },
  });
  expect(accept.status(), await accept.text()).toBe(200);
  await page.getByLabel("Switch demo profile").selectOption("vendor");
  await expect(
    page.getByRole("heading", { name: "Hello, Riverbend Market & Goods." }),
  ).toBeVisible();
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
  expect(
    (
      await page.request.post("/api/fulfillment", {
        headers,
        data: { orderId: order.id, state: "READY_FOR_PICKUP" },
      })
    ).status(),
  ).toBe(200);
  await page.getByLabel("Switch demo profile").selectOption("runner");
  await expect(
    page.getByRole("heading", { name: "Hello, Jordan Ellis." }),
  ).toBeVisible();
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
  for (const state of ["PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"])
    expect(
      (
        await page.request.post("/api/fulfillment", {
          headers,
          data: { orderId: order.id, state },
        })
      ).status(),
    ).toBe(200);
  await page.getByLabel("Switch demo profile").selectOption("customer");
  await expect(page).toHaveURL(/\/$/);
  const updatedCard = page
    .locator(".cards .product")
    .filter({
      has: page.getByRole("heading", { name: edited.title, exact: true }),
    });
  await expect(updatedCard).toContainText("$12.34");
  await updatedCard.click();
  await expect(page.getByRole("dialog")).toContainText("9 available");
  await page.getByRole("button", { name: "Close details" }).click();
  expect(
    (
      await page.request.post("/api/fulfillment", {
        headers,
        data: { orderId: order.id, state: "COMPLETED" },
      })
    ).status(),
  ).toBe(200);
  const reward = await service
    .from("runners")
    .select("reward_points")
    .eq("id", session.data!.runner_id)
    .single();
  expect(Number(reward.data!.reward_points)).toBe(10);
  const quote = await service
    .from("listings")
    .select("id,vendors!inner(demo_workspace)")
    .eq("mode", "MAKE")
    .eq("vendors.demo_workspace", session.data!.workspace_id)
    .limit(1)
    .single();
  expect(
    (
      await page.request.post("/api/inquiries", {
        headers,
        data: {
          listingId: quote.data!.id,
          message: "Fictional custom gift quote",
        },
      })
    ).status(),
  ).toBe(200);
  const orderCount = await service
    .from("orders")
    .select("id")
    .eq("customer_id", session.data!.customer_id);
  expect(orderCount.data).toHaveLength(1);
  const isolated = await (
    await import("@playwright/test")
  ).request.newContext({ baseURL: "http://127.0.0.1:3000" });
  expect(
    (
      await isolated.post("/api/demo", { headers, data: { role: "customer" } })
    ).status(),
  ).toBe(200);
  const otherOrders = await isolated.get("/api/orders");
  expect((await otherOrders.json()).orders).toHaveLength(0);
  const otherCapture = await isolated.post("/api/capture", {
    headers,
    data: { orderId: order.id },
  });
  expect(otherCapture.status()).toBe(404);
  await isolated.dispose();
  await page.goto("/dashboard");
  await expect(page.locator("main:not([role=status])")).toContainText(
    "COMPLETED",
  );
  await expect(page.locator("main:not([role=status])")).toContainText(
    "Fictional custom gift quote",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const exited = await page.request.delete("/api/demo", { headers });
  expect(exited.status()).toBe(200);
  expect((await page.request.get("/api/orders")).status()).toBe(401);
  const expiredTicket = await service
    .from("demo_sessions")
    .select("expires_at")
    .eq("workspace_id", session.data!.workspace_id)
    .single();
  expect(Date.parse(expiredTicket.data!.expires_at)).toBeLessThanOrEqual(
    Date.now(),
  );
});
