import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

// Real local Auth/PostgreSQL and visible UI controls. The explicit Demo Mode
// simulation never calls PayPal or represents a genuine charge.
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
  throw Error("Acceptance fixtures require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
test.setTimeout(120000);
test.use({ actionTimeout: 15000 });

async function enter(page: Page) {
  await service.from("demo_entry_limits").delete().neq("key_hash", "");
  await page.goto("/");
  await page.getByRole("button", { name: "Enter Demo Mode" }).click();
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
}
async function switchTo(page: Page, role: string) {
  await page.getByLabel("Switch demo profile").selectOption(role);
  await expect(page.getByLabel("Switch demo profile")).toHaveValue(role);
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function evidence(page: Page, info: TestInfo, name: string) {
  // Next can stream the completed HTML into a hidden container before replacing
  // its visible loading fallback. Verify the user-visible page before capture.
  await expect(page.locator("main:not([role=status])")).toBeVisible();
  await noOverflow(page);
  const path = info.outputPath(name + ".png");
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, {
    path,
    contentType: "image/png",
  });
}
async function clickResponse(page: Page, name: string, endpoint: string) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith(endpoint) && r.request().method() !== "GET",
  );
  await page.getByRole("button", { name, exact: true }).click();
  expect((await response).status()).toBe(200);
}

test("visible controls simulate and complete a private demo order across customer, vendor and runner", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const financialRequests: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (request) => {
    if (
      /\/api\/(checkout|capture|refunds|payments\/status)(\?|$)/.test(
        request.url(),
      )
    )
      financialRequests.push(request.url());
  });
  await enter(page);
  await page
    .getByRole("textbox", { name: "Search listings" })
    .fill("Habanero Cinnamon Rolls");
  await page
    .locator(".cards .product")
    .filter({ hasText: "Habanero Cinnamon Rolls" })
    .click();
  await expect(page.getByRole("dialog")).toContainText("$4.50");
  await clickResponse(page, "Add to cart", "/api/cart");
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByLabel("Delivery address")).toHaveValue(
    /DEMO TEST ADDRESS/,
  );
  const preparedResponse = page.waitForResponse(
    (r) => r.url().endsWith("/api/cart") && r.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Prepare this vendor order" }).click();
  const prepared = await preparedResponse;
  expect(prepared.status()).toBe(200);
  const order = (await prepared.json()).order;
  expect(Number(order.total_cents)).toBe(450);
  await expect(page).toHaveURL(/\/dashboard/);
  const card = () =>
    page.locator(".simple-card").filter({
      has: page.getByRole("heading", { name: /\$4\.50 ·/ }),
    });
  await expect(card()).toContainText("DRAFT");
  await expect(
    card().getByRole("button", { name: "Simulate demo payment", exact: true }),
  ).toBeVisible();
  await clickResponse(
    page,
    "Simulate demo payment",
    "/api/demo/orders/simulate",
  );
  await page.reload();
  await expect(card()).toContainText("PAID");
  await expect(card()).toContainText("SIMULATED DEMO ORDER — NO PAYPAL CHARGE");
  await expect(page.locator(".payment-summary")).toContainText(
    "Captured Sandbox payments: $0.00",
  );
  await expect(page.locator(".payment-summary")).toContainText(
    "Simulated order value: $4.50",
  );
  const simulated = await service
    .from("orders")
    .select("demo_simulated,paypal_order_id,paypal_capture_id,paypal_refund_id")
    .eq("id", order.id)
    .single();
  expect(simulated.error).toBeNull();
  expect(simulated.data).toEqual({
    demo_simulated: true,
    paypal_order_id: null,
    paypal_capture_id: null,
    paypal_refund_id: null,
  });
  const replay = await page.request.post("/api/demo/orders/simulate", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: { orderId: order.id },
  });
  expect(replay.status()).toBe(200);
  await switchTo(page, "vendor");
  await expect(card()).toContainText("PAID");
  await expect(card()).toContainText("SIMULATED DEMO ORDER — NO PAYPAL CHARGE");
  await clickResponse(page, "Accept demo order", "/api/fulfillment");
  await expect(card()).toContainText("VENDOR ACCEPTED");
  await clickResponse(page, "Find a runner", "/api/fulfillment");
  await expect(card()).toContainText("RUNNER MATCHING");
  await switchTo(page, "runner");
  await expect(
    page.getByRole("button", { name: "Accept run", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main:not([role=status])")).not.toContainText(
    "Delivery: DEMO TEST ADDRESS",
  );
  await page
    .getByRole("combobox", { name: "Transportation", exact: true })
    .selectOption("Walking");
  await page.getByLabel("Maximum detour (miles)").fill("3");
  await clickResponse(page, "Available for the next hour", "/api/runner");
  await expect(
    page.getByText(
      "Available for one hour. Your public location is coarsened.",
    ),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "I’m already going to…", exact: true })
    .selectOption({ label: "Demo Hearth Bakery" });
  await clickResponse(page, "Share trip for one hour", "/api/runner");
  await expect(
    page.getByText(
      "Trip intention shared for one hour. Exact location is private.",
    ),
  ).toBeVisible();
  await clickResponse(page, "Accept run", "/api/runner");
  await expect(card()).toContainText("RUNNER ASSIGNED");
  await expect(card()).toContainText("SIMULATED DEMO ORDER — NO PAYPAL CHARGE");
  await card()
    .getByText("Private operational addresses (authorized participants only)")
    .click();
  await expect(card()).toContainText("Delivery: DEMO TEST ADDRESS");
  await switchTo(page, "vendor");
  await expect(
    card().getByRole("button", { name: "Cancel simulated order", exact: true }),
  ).toHaveCount(0);
  const assignedCancellation = await page.request.post(
    "/api/demo/orders/cancel",
    {
      headers: { Origin: "http://127.0.0.1:3000" },
      data: { orderId: order.id },
    },
  );
  expect(assignedCancellation.status()).toBe(409);
  await expect(card()).toContainText("RUNNER ASSIGNED");
  await clickResponse(page, "Mark ready for pickup", "/api/fulfillment");
  await expect(card()).toContainText("READY FOR PICKUP");
  await switchTo(page, "runner");
  for (const [button, state] of [
    ["Confirm pickup", "PICKED UP"],
    ["Start delivery", "OUT FOR DELIVERY"],
    ["Confirm delivered", "DELIVERED"],
  ]) {
    await clickResponse(page, button, "/api/fulfillment");
    await expect(card()).toContainText(state);
  }
  await switchTo(page, "customer");
  await page.goto("/dashboard");
  await clickResponse(page, "Confirm order complete", "/api/fulfillment");
  await expect(card()).toContainText("COMPLETED");
  await expect(card()).toContainText("SIMULATED DEMO ORDER — NO PAYPAL CHARGE");
  const progress = page.locator(".community-progress");
  await expect(progress).toContainText("10 community points");
  await card().getByText("Leave a review", { exact: true }).click();
  await card().getByLabel("Rating out of five").fill("1");
  await card()
    .getByLabel("Your review")
    .fill(
      "Fictional local test: pickup was complete, but packaging needed care.",
    );
  await clickResponse(page, "Save review", "/api/reviews");
  await expect(card()).toContainText("Review saved. Thank you, neighbor.");
  await page.reload();
  await expect(progress).toContainText("15 community points");
  const completedReplay = await page.request.post("/api/demo/orders/simulate", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: { orderId: order.id },
  });
  expect(completedReplay.status()).toBe(200);
  await expect(progress).toContainText("1 completed purchase");
  await expect(progress).toContainText("1 thoughtful review");
  // A substantive one-star review earns the same recognition as five stars.
  // The unique review/order constraint also prevents repeatedly earning points.
  const duplicate = await page.request.post("/api/reviews", {
    headers: { Origin: "http://127.0.0.1:3000" },
    data: {
      orderId: order.id,
      rating: 5,
      comment: "A duplicate must never add another review or more points.",
    },
  });
  expect(duplicate.status()).toBe(409);
  await page.reload();
  await expect(progress).toContainText("15 community points");
  const reviews = await service
    .from("reviews")
    .select("rating")
    .eq("order_id", order.id);
  expect(reviews.error).toBeNull();
  expect(reviews.data).toEqual([{ rating: 1 }]);
  await evidence(page, info, "SIMULATED-DEMO-customer-completed-order");
  await page.goto(`/vendors/${order.vendor_id}`);
  await expect(page.locator("main:not([role=status])")).toBeVisible();
  await expect(page.locator("main:not([role=status])")).toContainText(
    "1.0 / 5",
  );
  await expect(page.locator("main:not([role=status])")).toContainText(
    "1 completed-order review",
  );
  await expect(page.locator("main:not([role=status])")).not.toContainText(
    "Fictional local test: pickup was complete, but packaging needed care.",
  );
  await expect(page.locator(".community-progress")).toHaveCount(0);
  await expect(
    page.getByText("Community favorite", { exact: true }),
  ).toHaveCount(0);
  await evidence(page, info, "SIMULATED-DEMO-vendor-order-rating");
  await switchTo(page, "vendor");
  const vendorProgress = page.locator(".vendor-progress");
  await expect(vendorProgress).toContainText("1 fulfilled order");
  await expect(vendorProgress).toContainText("1 completed-order review");
  await expect(vendorProgress).toContainText(
    "1.0 / 5 average across your storefronts",
  );
  await switchTo(page, "runner");
  await expect(page.locator("main:not([role=status])")).toContainText(
    "1 completed runs",
  );
  await expect(page.locator("main:not([role=status])")).toContainText(
    "10 demo rewards points",
  );
  await expect(
    page.getByText("Simulated Runner Payout — Demo Only"),
  ).toBeVisible();
  await evidence(page, info, "SIMULATED-DEMO-runner-completion-and-earnings");
  const ledger = await service
    .from("ledger")
    .select("kind,simulated,amount_cents")
    .eq("order_id", order.id);
  expect(ledger.data?.filter((l) => l.kind === "DEMO_PAYMENT")).toHaveLength(1);
  expect(
    ledger.data?.filter((l) => l.kind === "CUSTOMER_PAYMENT"),
  ).toHaveLength(0);
  expect(ledger.data).toHaveLength(4);
  expect(ledger.data?.every((entry) => entry.simulated)).toBe(true);
  expect(
    Number(
      ledger.data?.find((entry) => entry.kind === "DEMO_PAYMENT")?.amount_cents,
    ),
  ).toBe(450);
  const finalOrder = await service
    .from("orders")
    .select(
      "state,demo_simulated,paypal_order_id,paypal_capture_id,paypal_refund_id,runner_id",
    )
    .eq("id", order.id)
    .single();
  expect(finalOrder.error).toBeNull();
  expect(finalOrder.data!.demo_simulated).toBe(true);
  expect(finalOrder.data!.state).toBe("COMPLETED");
  expect(finalOrder.data!.paypal_order_id).toBeNull();
  expect(finalOrder.data!.paypal_capture_id).toBeNull();
  expect(finalOrder.data!.paypal_refund_id).toBeNull();
  const runner = await service
    .from("runners")
    .select("completed_runs,reward_points")
    .eq("id", finalOrder.data!.runner_id)
    .single();
  expect(runner.error).toBeNull();
  expect(Number(runner.data!.completed_runs)).toBe(1);
  expect(Number(runner.data!.reward_points)).toBe(10);
  const paymentEvents = await service
    .from("payment_events")
    .select("event_id")
    .eq("order_id", order.id);
  expect(paymentEvents.error).toBeNull();
  expect(paymentEvents.data).toHaveLength(0);
  expect(financialRequests).toEqual([]);
  await info.attach("demo-simulation-boundary.json", {
    body: JSON.stringify(
      {
        backend: "loopback Auth/PostgreSQL",
        payment: "EXPLICIT DEMO SIMULATION; no PayPal order or capture",
        orderId: order.id,
        finalState: "COMPLETED",
        actualPayPalRequests: 0,
        realPayouts: false,
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(errors).toEqual([]);
});

test("discovery, map location, filters, cart removal and quote replies work through visible controls", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 39.45, longitude: -91.05 });
  await page.getByRole("button", { name: "Show my approximate area" }).click();
  await expect(
    page.getByText("Your approximate area is shown only in this browser.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await expect(page.locator(".cards .product")).toHaveCount(5);
  await page
    .getByRole("textbox", { name: "Search listings" })
    .fill("NO MATCH LOCAL ACCEPTANCE");
  await expect(
    page.getByText("No finds yet. Try another category or a shorter search."),
  ).toBeVisible();
  await page.getByRole("textbox", { name: "Search listings" }).fill("");
  await page.getByRole("button", { name: "Everything", exact: true }).click();
  await expect(page.locator(".cards .product")).toHaveCount(4);
  const local = page.getByRole("button", { name: "MADE LOCAL", exact: true });
  await local.click();
  await expect(local).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cards .product")).not.toContainText([
    "Secondhand Reading Lamp",
  ]);
  await local.click();
  await page
    .getByRole("button", { name: "Browse Riverbend Market & Goods items" })
    .click();
  await expect(page.locator(".cards .product")).toHaveCount(10);
  await page.getByRole("button", { name: "Show all vendors" }).click();
  await page
    .getByRole("textbox", { name: "Search listings" })
    .fill("Handmade River Mug");
  await page.locator(".cards .product").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Increase quantity" }).click();
  await expect(dialog).toContainText("$56.00");
  await page.keyboard.press("Shift+Tab");
  expect(
    await page.evaluate(() =>
      Boolean(
        document
          .querySelector('[role="dialog"]')
          ?.contains(document.activeElement),
      ),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.locator(".cards .product").click();
  await clickResponse(page, "Add to cart", "/api/cart");
  await expect(page).toHaveURL(/\/cart$/);
  await clickResponse(page, "Remove", "/api/cart");
  await expect(
    page.getByRole("heading", {
      name: "Your cart is ready for a little discovery.",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Find something local →" }).click();
  await page
    .getByRole("textbox", { name: "Search listings" })
    .fill("Custom House Sign");
  await page.locator(".cards .product").click();
  await expect(page.getByRole("dialog")).toContainText("Quote required");
  await clickResponse(page, "Request a quote", "/api/inquiries");
  await expect(page.getByRole("dialog")).toContainText(
    "No order or payment was created",
  );
  await page.getByRole("button", { name: "Close details" }).click();
  await switchTo(page, "vendor");
  const inquiry = page.locator(".simple-card").filter({
    hasText: "Please share availability and a quote for Custom House Sign.",
  });
  await inquiry
    .getByLabel("Reply with scope and availability")
    .fill(
      "Fictional quote: custom sign available next week. No booking or charge.",
    );
  await clickResponse(page, "Send response", "/api/inquiries");
  await switchTo(page, "customer");
  await page.goto("/dashboard");
  await expect(page.locator("main:not([role=status])")).toContainText(
    "Fictional quote: custom sign available next week.",
  );
  await expect(
    page.getByRole("heading", { name: "Your payment history" }),
  ).toBeVisible();
  await expect(
    page.getByText("No orders yet. Find something in your neighborhood."),
  ).toBeVisible();
  await evidence(
    page,
    info,
    "LOCAL-DEMO-customer-quote-response-and-empty-order-state",
  );
  expect(errors).toEqual([]);
});
