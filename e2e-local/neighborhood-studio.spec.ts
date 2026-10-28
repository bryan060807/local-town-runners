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
  throw Error("Studio fixtures require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const headers = { Origin: "http://127.0.0.1:3000" };
test.setTimeout(90000);
test.use({ actionTimeout: 15000 });

test("private connection preview uses the actual gift and shared trip, expires honestly, and creates no order", async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  const protectedWrites: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      (request.method() !== "GET" &&
        /^\/api\/(orders|cart|prepare|checkout|capture|refunds|fulfillment|runner|reviews|inquiries|demo\/orders)(\/|$)/.test(
          path,
        )) ||
      path.startsWith("/api/internal/")
    )
      protectedWrites.push(request.method() + " " + path);
  });
  await page.clock.install({ time: new Date() });
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
    await expect(page.getByLabel("Switch demo profile")).toHaveValue(
      "customer",
    );
    const ticket = (await context.cookies()).find(
      (cookie) => cookie.name === "ltr_demo_ticket",
    );
    expect(ticket?.value).toBeTruthy();
    const session = await service
      .from("demo_sessions")
      .select("workspace_id,customer_id,runner_id")
      .eq(
        "token_hash",
        createHash("sha256").update(ticket!.value).digest("hex"),
      )
      .single();
    expect(session.error).toBeNull();
    const shops = await service
      .from("vendors")
      .select("id")
      .eq("demo_workspace", session.data!.workspace_id);
    expect(shops.error).toBeNull();
    const mug = await service
      .from("listings")
      .select("id,vendor_id,title,price_cents")
      .in(
        "vendor_id",
        shops.data!.map((shop) => shop.id),
      )
      .eq("title", "Handmade River Mug")
      .single();
    expect(mug.error).toBeNull();
    expect(Number(mug.data!.price_cents)).toBe(2800);
    const trip = await service
      .from("runner_trips")
      .select("id,runner_id,destination_vendor_id,expires_at")
      .eq("runner_id", session.data!.runner_id)
      .eq("destination_vendor_id", mug.data!.vendor_id)
      .gt("expires_at", new Date().toISOString())
      .single();
    expect(trip.error).toBeNull();

    const studio = page.getByRole("region", {
      name: "Neighborhood Connection",
      exact: true,
    });
    const selected = studio.getByRole("article", {
      name: "Selected find",
      exact: true,
    });
    await expect(selected).toHaveAttribute("data-listing-id", mug.data!.id);
    await expect(selected.getByLabel("Item price", { exact: true })).toHaveText(
      "$28.00",
    );
    await expect(studio).toContainText("Fictional vendor");
    const candidate = studio.getByRole("group", {
      name: "Declared trip candidate",
      exact: true,
    });
    await expect(candidate).toBeVisible();
    await expect(candidate).toContainText("Jordan Ellis");
    await expect(studio.getByRole("note")).toContainText(
      "Runner confirmation needed",
    );
    await expect(studio).toContainText("Demo runner");

    const answer = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/assistant" &&
        response.request().method() === "POST",
    );
    await studio
      .getByRole("button", { name: "Ask Sidekick", exact: true })
      .click();
    const response = await answer;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON().previousListing).toBe(
      mug.data!.id,
    );
    expect(
      (await response.json()).listings.map((item: { id: string }) => item.id),
    ).toEqual([mug.data!.id]);

    await studio
      .getByRole("button", { name: "Review this find", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Handmade River Mug");
    await expect(dialog).toContainText("$28.00");
    await dialog.getByRole("button", { name: "Close details" }).click();
    await expect(dialog).toHaveCount(0);
    const orders = await service
      .from("orders")
      .select("id")
      .eq("customer_id", session.data!.customer_id);
    expect(orders.error).toBeNull();
    expect(orders.data).toHaveLength(0);

    // Only this newly created local workspace's declared trip is shortened.
    // A virtual clock then exercises expiry without polling or waiting a minute.
    expect(
      (
        await service
          .from("runner_trips")
          .update({ expires_at: new Date(Date.now() + 45000).toISOString() })
          .eq("id", trip.data!.id)
          .eq("runner_id", session.data!.runner_id)
      ).error,
    ).toBeNull();
    await page.reload();
    await expect(candidate).toBeVisible();
    const beforeExpiry = info.outputPath("LOCAL-STUDIO-shared-trip.png");
    await studio.screenshot({ path: beforeExpiry });
    await info.attach("LOCAL-STUDIO-shared-trip", {
      path: beforeExpiry,
      contentType: "image/png",
    });
    await page.clock.fastForward(60000);
    await expect(candidate).toHaveCount(0);
    await expect(
      studio.getByRole("group", { name: "Pickup options", exact: true }),
    ).toContainText("No shared trip to this shop in this preview.");
    await expect(selected).toHaveAttribute("data-listing-id", mug.data!.id);
    const after = await service
      .from("orders")
      .select("id")
      .eq("customer_id", session.data!.customer_id);
    expect(after.error).toBeNull();
    expect(after.data).toHaveLength(0);
    expect(protectedWrites).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const afterExpiry = info.outputPath("LOCAL-STUDIO-expired-trip.png");
    await studio.screenshot({ path: afterExpiry });
    await info.attach("LOCAL-STUDIO-expired-trip", {
      path: afterExpiry,
      contentType: "image/png",
    });
  } finally {
    if (entered)
      expect(
        (await page.request.delete("/api/demo", { headers })).status(),
      ).toBe(200);
  }
});
