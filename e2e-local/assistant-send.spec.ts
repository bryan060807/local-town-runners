import { test, expect, Page, BrowserContext } from "@playwright/test";
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
  throw Error("Assistant send fixtures require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const origin = "http://127.0.0.1:3000";
const headers = { Origin: origin };
test.setTimeout(90000);
test.use({ actionTimeout: 15000 });

async function enterCustomer(page: Page, context: BrowserContext) {
  expect(
    (await service.from("demo_entry_limits").delete().neq("key_hash", ""))
      .error,
  ).toBeNull();
  await page.goto("/");
  const entry = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/demo" &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Enter Demo Mode", exact: true })
    .click();
  expect((await entry).status()).toBe(200);
  await expect(page.getByLabel("Switch demo profile")).toHaveValue("customer");
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
  const ticket = (await context.cookies()).find(
    (cookie) => cookie.name === "ltr_demo_ticket",
  );
  expect(ticket?.value).toBeTruthy();
  const session = await service
    .from("demo_sessions")
    .select("workspace_id,customer_id")
    .eq("token_hash", createHash("sha256").update(ticket!.value).digest("hex"))
    .single();
  expect(session.error).toBeNull();
  return session.data!;
}

function assistantReply(page: Page) {
  return page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/assistant" &&
      response.request().method() === "POST",
  );
}

test("Sidekick submits discovery with Enter and a two-roll quote with the Send button without creating an order", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const protectedWrites: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (
      request.method() !== "GET" &&
      /^\/api\/(orders|cart|prepare|checkout|capture|refunds|fulfillment|runner|reviews|inquiries|demo\/orders)(\/|$)/.test(
        new URL(request.url()).pathname,
      )
    )
      protectedWrites.push(
        request.method() + " " + new URL(request.url()).pathname,
      );
  });
  let entered = false;
  try {
    const session = await enterCustomer(page, context);
    entered = true;
    const input = page.getByRole("textbox", {
      name: "Ask your local sidekick",
    });
    const send = page.getByRole("button", {
      name: "Send message",
      exact: true,
    });
    await input.fill("Who has cinnamon rolls?");
    const discovery = assistantReply(page);
    await input.press("Enter");
    const discovered = await discovery;
    expect(discovered.status()).toBe(200);
    const result = await discovered.json();
    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]).toMatchObject({
      title: "Habanero Cinnamon Rolls",
      price: 450,
    });
    const listing = await service
      .from("listings")
      .select("id,vendors!inner(demo_workspace)")
      .eq("id", result.listings[0].id)
      .eq("vendors.demo_workspace", session.workspace_id)
      .single();
    expect(listing.error).toBeNull();
    await expect(page.locator(".assistant .mini-results")).toContainText(
      "Habanero Cinnamon Rolls",
    );
    await input.fill("Get me two of the Habanero Cinnamon Rolls");
    const quote = assistantReply(page);
    await send.click();
    const response = await quote;
    expect(response.status()).toBe(200);
    const preview = await response.json();
    expect(preview.prepared).toEqual({
      listingId: listing.data!.id,
      quantity: 2,
      totalCents: 900,
    });
    expect(preview.tools).toContain("prepareOrder");
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Habanero Cinnamon Rolls");
    await expect(dialog).toContainText("$9.00");
    await expect(dialog.getByRole("status")).toContainText("quote only");
    const orders = await service
      .from("orders")
      .select("id")
      .eq("customer_id", session.customer_id);
    expect(orders.error).toBeNull();
    expect(orders.data).toHaveLength(0);
    expect(protectedWrites).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    if (entered)
      expect(
        (await page.request.delete("/api/demo", { headers })).status(),
      ).toBe(200);
  }
});

test("a failed Sidekick send keeps the draft and blocks duplicate submits until it can be retried", async ({
  page,
  context,
}) => {
  let entered = false;
  let releaseFailure: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    releaseFailure = resolve;
  });
  let attempts = 0;
  try {
    await enterCustomer(page, context);
    entered = true;
    await page.route("**/api/assistant", async (route) => {
      attempts++;
      if (attempts === 1) {
        await gate;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Assistant temporarily unavailable." }),
        });
      } else await route.continue();
    });
    const input = page.getByRole("textbox", {
      name: "Ask your local sidekick",
    });
    const send = page.getByRole("button", {
      name: "Send message",
      exact: true,
    });
    const draft = "Who has cinnamon rolls?";
    await input.fill(draft);
    await input.press("Enter");
    await expect(page.locator(".assistant .reply")).toContainText(
      "Looking around",
    );
    await expect(input).toHaveJSProperty("readOnly", true);
    await expect(input).toBeFocused();
    await expect(send).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Ask Sidekick", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Who has cinnamon rolls?",
        exact: true,
      }),
    ).toBeDisabled();
    await input.press("Enter");
    expect(attempts).toBe(1);
    releaseFailure!();
    await expect(page.locator(".assistant .reply")).toContainText(
      "Assistant temporarily unavailable.",
    );
    await expect(input).toBeEnabled();
    await expect(input).toHaveJSProperty("readOnly", false);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(draft);
    await expect(send).toBeEnabled();
    const reply = assistantReply(page);
    await input.press("Enter");
    expect((await reply).status()).toBe(200);
    await expect(page.locator(".assistant .mini-results")).toContainText(
      "Habanero Cinnamon Rolls",
    );
    await expect(input).toHaveValue("");
    expect(attempts).toBe(2);
  } finally {
    releaseFailure?.();
    if (entered)
      expect(
        (await page.request.delete("/api/demo", { headers })).status(),
      ).toBe(200);
  }
});
