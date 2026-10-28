import { test, expect } from "@playwright/test";
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
  throw Error("Studio entry fixtures require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const headers = { Origin: "http://127.0.0.1:3000" };
test.setTimeout(90000);
test.use({ actionTimeout: 15000 });

test("a public no-trip preview builds a fresh private demo with the actual gift connection and no order", async ({
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
  expect(
    (await service.from("demo_entry_limits").delete().neq("key_hash", ""))
      .error,
  ).toBeNull();
  const publicBowl = await service
    .from("listings")
    .select("id,vendors!inner(demo_workspace)")
    .eq("title", "Garden Lunch Bowl")
    .eq("vendors.demo_workspace", templateWorkspace)
    .single();
  expect(publicBowl.error).toBeNull();
  let entered = false;
  try {
    await page.goto("/");
    const demo = page.getByRole("region", { name: "Demo Mode", exact: true });
    await expect(
      demo.getByRole("button", { name: "Enter Demo Mode", exact: true }),
    ).toBeEnabled();
    const before = await page.request.get("/api/demo");
    expect(before.status()).toBe(200);
    expect(await before.json()).toMatchObject({ enabled: true, active: false });
    const studio = page.getByRole("region", {
      name: "Neighborhood Connection",
      exact: true,
    });
    await studio
      .getByRole("button", { name: "Something to eat", exact: true })
      .click();
    await studio
      .getByRole("group", { name: "Available finds", exact: true })
      .getByRole("button", { name: "Preview Garden Lunch Bowl", exact: true })
      .click();
    const selected = studio.getByRole("article", {
      name: "Selected find",
      exact: true,
    });
    await expect(selected).toHaveAttribute(
      "data-listing-id",
      publicBowl.data!.id,
    );
    await expect(
      studio.getByRole("group", { name: "Pickup options", exact: true }),
    ).toContainText("No shared trip to this shop in this preview.");
    await expect(
      studio.getByRole("group", {
        name: "Declared trip candidate",
        exact: true,
      }),
    ).toHaveCount(0);
    const build = studio.getByRole("button", {
      name: "Build a private demo",
      exact: true,
    });
    await expect(build).toBeVisible();
    const entry = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/demo" &&
        response.request().method() === "POST",
    );
    await build.click();
    const response = await entry;
    expect(response.status()).toBe(200);
    expect(response.request().postDataJSON()).toEqual({ role: "customer" });
    entered = true;
    await expect(page.getByLabel("Switch demo profile")).toHaveValue(
      "customer",
    );
    await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
    await expect(
      demo.getByText("Viewing Customer", { exact: true }),
    ).toBeVisible();
    await expect(studio).toContainText("Your private demo");
    await expect(
      studio.getByRole("button", { name: "A gift under $30", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const ticket = (await context.cookies()).find(
      (cookie) => cookie.name === "ltr_demo_ticket",
    );
    expect(ticket?.value).toBeTruthy();
    expect(ticket?.httpOnly).toBe(true);
    const session = await service
      .from("demo_sessions")
      .select("workspace_id,customer_id,runner_id")
      .eq(
        "token_hash",
        createHash("sha256").update(ticket!.value).digest("hex"),
      )
      .single();
    expect(session.error).toBeNull();
    expect(session.data!.workspace_id).not.toBe(templateWorkspace);
    const shops = await service
      .from("vendors")
      .select("id")
      .eq("demo_workspace", session.data!.workspace_id);
    expect(shops.error).toBeNull();
    const mug = await service
      .from("listings")
      .select("id,price_cents")
      .in(
        "vendor_id",
        shops.data!.map((shop) => shop.id),
      )
      .eq("title", "Handmade River Mug")
      .single();
    expect(mug.error).toBeNull();
    expect(Number(mug.data!.price_cents)).toBe(2800);
    await expect(selected).toHaveAttribute("data-listing-id", mug.data!.id);
    await expect(selected.getByLabel("Item price", { exact: true })).toHaveText(
      "$28.00",
    );
    await expect(studio).toContainText("Fictional vendor");
    await expect(
      studio.getByRole("group", {
        name: "Declared trip candidate",
        exact: true,
      }),
    ).toContainText("Jordan Ellis");
    await expect(build).toHaveCount(0);
    const active = await page.request.get("/api/demo");
    expect(active.status()).toBe(200);
    expect(await active.json()).toMatchObject({
      enabled: true,
      active: true,
      role: "customer",
    });
    const orders = await service
      .from("orders")
      .select("id")
      .eq("customer_id", session.data!.customer_id);
    expect(orders.error).toBeNull();
    expect(orders.data).toHaveLength(0);
    expect(protectedWrites).toEqual([]);
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const screenshot = info.outputPath("LOCAL-STUDIO-private-entry.png");
    await studio.screenshot({ path: screenshot });
    await info.attach("LOCAL-STUDIO-private-entry", {
      path: screenshot,
      contentType: "image/png",
    });
    await demo.getByRole("button", { name: "Exit demo", exact: true }).click();
    await expect(
      demo.getByRole("button", { name: "Enter Demo Mode", exact: true }),
    ).toBeEnabled();
    const exited = await page.request.get("/api/demo");
    expect(exited.status()).toBe(200);
    expect(await exited.json()).toMatchObject({ enabled: true, active: false });
    entered = false;
  } finally {
    if (entered)
      expect(
        (await page.request.delete("/api/demo", { headers })).status(),
      ).toBe(200);
  }
});
