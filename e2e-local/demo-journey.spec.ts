import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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
  throw Error("Demo journey fixtures require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const headers = { Origin: "http://127.0.0.1:3000" };
test.setTimeout(90000);
test.use({ actionTimeout: 15000 });

test("a new visitor without WebGL can enter the private demo, understand each role and exit", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const financialRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      /\/api\/(checkout|capture|refunds|payments\/status)(\?|$)/.test(
        request.url(),
      )
    )
      financialRequests.push(new URL(request.url()).pathname);
  });
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...args: unknown[]
    ) {
      if (["webgl", "webgl2", "experimental-webgl"].includes(contextId))
        return null;
      return Reflect.apply(original, this, [contextId, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  expect(
    (await service.from("demo_entry_limits").delete().neq("key_hash", ""))
      .error,
  ).toBeNull();
  const anonymous = await page.request.get("/api/demo");
  expect(anonymous.status()).toBe(200);
  expect(await anonymous.json()).toMatchObject({
    enabled: true,
    active: false,
  });
  let entered = false;
  try {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Good things. Close to home." }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Good finds are still close by." }),
    ).toBeVisible();
    const demo = page.getByRole("region", { name: "Demo Mode", exact: true });
    await expect(
      demo.getByRole("button", { name: "Enter Demo Mode", exact: true }),
    ).toBeEnabled();
    await demo
      .getByRole("button", { name: "Enter Demo Mode", exact: true })
      .click();
    entered = true;
    const profile = demo.getByRole("combobox", {
      name: "Switch demo profile",
      exact: true,
    });
    await expect(profile).toBeEnabled();
    await expect(profile).toHaveValue("customer");
    await expect(
      demo.getByText("Viewing Customer", { exact: true }),
    ).toBeVisible();
    const ticket = (await context.cookies()).find(
      (cookie) => cookie.name === "ltr_demo_ticket",
    );
    expect(ticket?.httpOnly).toBe(true);
    expect(ticket?.value).toBeTruthy();

    await demo
      .locator("summary")
      .filter({ hasText: "How the demo works" })
      .click();
    const roles = demo.getByRole("list", { name: "Demo roles", exact: true });
    await expect(roles).toBeVisible();
    await expect(roles.getByRole("listitem")).toHaveCount(3);
    for (const role of ["Customer", "Vendor", "Runner"])
      await expect(roles).toContainText(role);

    for (const role of ["vendor", "runner", "customer"] as const) {
      await profile.selectOption(role);
      await expect(profile).toHaveValue(role);
      await expect(profile).toBeEnabled();
      await expect(
        demo.getByText("Viewing " + role[0].toUpperCase() + role.slice(1), {
          exact: true,
        }),
      ).toBeVisible();
      const current = await page.request.get("/api/demo");
      expect(current.status()).toBe(200);
      expect(await current.json()).toMatchObject({
        enabled: true,
        active: true,
        role,
      });
      expect(
        (await context.cookies()).find(
          (cookie) => cookie.name === "ltr_demo_ticket",
        )?.value,
      ).toBe(ticket!.value);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByText("We couldn’t load that just now.", { exact: true }),
      ).toHaveCount(0);
    }
    await demo.getByRole("button", { name: "Exit demo", exact: true }).click();
    await expect(
      demo.getByRole("button", { name: "Enter Demo Mode", exact: true }),
    ).toBeEnabled();
    const exited = await page.request.get("/api/demo");
    expect(exited.status()).toBe(200);
    expect(await exited.json()).toMatchObject({ enabled: true, active: false });
    entered = false;
    expect(financialRequests).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    if (entered)
      expect(
        (await page.request.delete("/api/demo", { headers })).status(),
      ).toBe(200);
  }
});

test("the under-$30 gift story follows an existing neighbor trip through one simulated completed order", async ({
  page,
  context,
}, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const financialRequests: string[] = [];
  const runnerSetupRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (/^\/api\/(checkout|capture|refunds|payments\/status)$/.test(pathname))
      financialRequests.push(pathname);
    if (pathname === "/api/runner" && request.method() === "POST") {
      const data = request.postDataJSON();
      if (["availability", "trip"].includes(data.action))
        runnerSetupRequests.push(data.action);
    }
  });
  expect(
    (await service.from("demo_entry_limits").delete().neq("key_hash", ""))
      .error,
  ).toBeNull();
  let entered = false;
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Enter Demo Mode", exact: true })
      .click();
    entered = true;
    const profile = page.getByRole("combobox", {
      name: "Switch demo profile",
      exact: true,
    });
    await expect(profile).toBeEnabled();
    await expect(profile).toHaveValue("customer");
    const ticket = (await context.cookies()).find(
      (cookie) => cookie.name === "ltr_demo_ticket",
    )!;
    expect(ticket?.value).toBeTruthy();
    const session = await service
      .from("demo_sessions")
      .select("workspace_id,customer_id,runner_id")
      .eq("token_hash", createHash("sha256").update(ticket.value).digest("hex"))
      .single();
    expect(session.error).toBeNull();
    const mug = await service
      .from("listings")
      .select("id,vendor_id,price_cents,vendors!inner(demo_workspace)")
      .eq("title", "Handmade River Mug")
      .eq("vendors.demo_workspace", session.data!.workspace_id)
      .single();
    expect(mug.error).toBeNull();
    expect(Number(mug.data!.price_cents)).toBe(2800);

    async function ask(message: string) {
      const response = page.waitForResponse(
        (candidate) =>
          new URL(candidate.url()).pathname === "/api/assistant" &&
          candidate.request().method() === "POST",
      );
      await page
        .getByRole("textbox", { name: "Ask your local sidekick" })
        .fill(message);
      await page
        .getByRole("button", { name: "Send message", exact: true })
        .click();
      const result = await response;
      expect(result.status()).toBe(200);
      const data = await result.json();
      await expect(page.locator(".assistant .reply")).toHaveText(data.text);
      return data;
    }
    const gifts = await ask("A birthday gift under $30");
    expect(gifts.listings).toHaveLength(4);
    expect(
      gifts.listings.every(
        (item: { category: string; price: number }) =>
          item.category === "Gifts" && item.price <= 3000,
      ),
    ).toBe(true);
    const selected = await ask("Tell me about Handmade River Mug");
    expect(selected.listings.map((item: { id: string }) => item.id)).toEqual([
      mug.data!.id,
    ]);
    await expect(page.locator(".mini-results")).toContainText(
      "Handmade River Mug",
    );
    const neighbor = await ask("Who could bring it?");
    expect(neighbor.matchedRunnerId).toBe(session.data!.runner_id);
    expect(neighbor.text).toContain("already heading toward this vendor");
    const quote = await ask("Get me one.");
    expect(quote.prepared).toEqual({
      listingId: mug.data!.id,
      quantity: 1,
      totalCents: 2800,
    });
    const quotedOrders = await service
      .from("orders")
      .select("id")
      .eq("customer_id", session.data!.customer_id);
    expect(quotedOrders.error).toBeNull();
    expect(quotedOrders.data).toHaveLength(0);
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Handmade River Mug", exact: true }),
    ).toBeVisible();
    await expect(dialog).toContainText("$28.00");
    await expect(dialog).toContainText("This is a quote only");
    await expect(dialog.getByLabel("Private delivery address")).toHaveValue(
      /DEMO TEST ADDRESS/,
    );
    const preparation = page.waitForResponse(
      (candidate) =>
        new URL(candidate.url()).pathname === "/api/orders" &&
        candidate.request().method() === "POST",
    );
    await dialog
      .getByRole("button", { name: "Prepare order", exact: true })
      .click();
    const prepared = await preparation;
    expect(prepared.status()).toBe(200);
    expect(prepared.request().postDataJSON().listingId).toBe(mug.data!.id);
    const order = (await prepared.json()).order;
    expect(order.listing_id).toBe(mug.data!.id);
    expect(order.vendor_id).toBe(mug.data!.vendor_id);
    expect(order.customer_id).toBe(session.data!.customer_id);
    expect(order.quantity).toBe(1);
    expect(Number(order.total_cents)).toBe(2800);
    expect(order.state).toBe("DRAFT");
    await expect(page).toHaveURL(/\/dashboard\?prepared=/);
    const card = () =>
      page.locator(".simple-card").filter({
        has: page.getByRole("heading", { name: /\$28\.00 ·/ }),
      });
    await expect(card()).toContainText(`Order ${order.id}`);

    async function clickAction(name: string, endpoint: string) {
      const response = page.waitForResponse(
        (candidate) =>
          new URL(candidate.url()).pathname === endpoint &&
          candidate.request().method() === "POST",
      );
      await page.getByRole("button", { name, exact: true }).click();
      const result = await response;
      expect(result.status()).toBe(200);
      expect(result.request().postDataJSON().orderId).toBe(order.id);
    }
    async function switchTo(role: "customer" | "vendor" | "runner") {
      await profile.selectOption(role);
      await expect(profile).toHaveValue(role);
      await expect(profile).toBeEnabled();
      await expect(
        page.getByText("Viewing " + role[0].toUpperCase() + role.slice(1), {
          exact: true,
        }),
      ).toBeVisible();
    }
    async function next(title: string) {
      await expect(
        card().getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(card()).toContainText(
        "SIMULATED DEMO ORDER — NO PAYPAL CHARGE",
      );
    }
    await clickAction("Simulate demo payment", "/api/demo/orders/simulate");
    await next("Up next: Vendor");
    await switchTo("vendor");
    await clickAction("Accept demo order", "/api/fulfillment");
    await next("Up next: Vendor");
    await clickAction("Find a runner", "/api/fulfillment");
    await next("Up next: Runner");
    await switchTo("runner");
    // This is the same default, still-active trip that the assistant quoted.
    // The story should not need hidden availability or destination setup.
    await clickAction("Accept run", "/api/runner");
    await next("Up next: Vendor");
    await switchTo("vendor");
    await clickAction("Mark ready for pickup", "/api/fulfillment");
    await next("Up next: Runner");
    await switchTo("runner");
    for (const [name, state, title] of [
      ["Confirm pickup", "PICKED UP", "Up next: Runner"],
      ["Start delivery", "OUT FOR DELIVERY", "Up next: Runner"],
      ["Confirm delivered", "DELIVERED", "Up next: Customer"],
    ]) {
      await clickAction(name, "/api/fulfillment");
      await expect(card()).toContainText(state);
      await next(title);
    }
    await switchTo("customer");
    await page.goto("/dashboard");
    await clickAction("Confirm order complete", "/api/fulfillment");
    await next("Walkthrough complete");
    await expect(card()).toContainText("COMPLETED");
    await expect(page.locator(".community-progress")).toContainText(
      "10 community points",
    );
    await expect(page.locator(".community-progress")).toContainText(
      "1 completed purchase",
    );
    await expect(page.locator(".payment-summary")).toContainText(
      "Captured Sandbox payments: $0.00",
    );

    const finalOrder = await service
      .from("orders")
      .select(
        "state,demo_simulated,paypal_order_id,paypal_capture_id,paypal_refund_id,runner_id,payout_status",
      )
      .eq("id", order.id)
      .single();
    expect(finalOrder.error).toBeNull();
    expect(finalOrder.data).toEqual({
      state: "COMPLETED",
      demo_simulated: true,
      paypal_order_id: null,
      paypal_capture_id: null,
      paypal_refund_id: null,
      runner_id: session.data!.runner_id,
      payout_status: "SIMULATED",
    });
    const ledger = await service
      .from("ledger")
      .select("kind,simulated,amount_cents")
      .eq("order_id", order.id);
    expect(ledger.error).toBeNull();
    expect(ledger.data).toHaveLength(4);
    expect(ledger.data!.every((entry) => entry.simulated)).toBe(true);
    expect(
      ledger.data!.filter((entry) => entry.kind === "DEMO_PAYMENT"),
    ).toHaveLength(1);
    expect(
      ledger.data!.filter((entry) => entry.kind === "CUSTOMER_PAYMENT"),
    ).toHaveLength(0);
    expect(
      Number(
        ledger.data!.find((entry) => entry.kind === "DEMO_PAYMENT")!
          .amount_cents,
      ),
    ).toBe(2800);

    for (const role of ["vendor", "runner"] as const) {
      await switchTo(role);
      const actualPayouts = page
        .locator(".payment-summary .balance-grid > div")
        .filter({ has: page.getByText("Actual payouts", { exact: true }) });
      await expect(actualPayouts).toContainText("$0.00");
    }
    await expect(page.locator("main:not([role=status])")).toContainText(
      "1 completed runs",
    );
    await expect(page.locator("main:not([role=status])")).toContainText(
      "10 demo rewards points",
    );
    await page.reload();
    const runner = await service
      .from("runners")
      .select("completed_runs,reward_points")
      .eq("id", session.data!.runner_id)
      .single();
    expect(runner.error).toBeNull();
    expect(Number(runner.data!.completed_runs)).toBe(1);
    expect(Number(runner.data!.reward_points)).toBe(10);
    const retainedLedger = await service
      .from("ledger")
      .select("kind,simulated,amount_cents")
      .eq("order_id", order.id);
    expect(retainedLedger.error).toBeNull();
    expect(retainedLedger.data).toHaveLength(4);
    await switchTo("customer");
    await page.goto("/dashboard");
    await next("Walkthrough complete");
    await expect(
      card().getByRole("button", {
        name: "Confirm order complete",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(page.locator(".community-progress")).toContainText(
      "10 community points",
    );
    expect(financialRequests).toEqual([]);
    expect(runnerSetupRequests).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const screenshot = info.outputPath("SIMULATED-gift-story-complete.png");
    await card().screenshot({ path: screenshot });
    await info.attach("SIMULATED-gift-story-complete", {
      path: screenshot,
      contentType: "image/png",
    });
  } finally {
    if (entered)
      expect(
        (await page.request.delete("/api/demo", { headers })).status(),
      ).toBe(200);
  }
});
