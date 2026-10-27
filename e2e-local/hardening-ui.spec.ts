import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID, randomBytes } from "node:crypto";
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
  throw Error("UI hardening fixtures require the dedicated local backend");
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
test.setTimeout(90000);

async function enter(page: Page) {
  await service.from("demo_entry_limits").delete().neq("key_hash", "");
  await page.goto("/");
  await page.getByRole("button", { name: "Enter Demo Mode" }).click();
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
}

test("runner writes stay serialized and recover after an interrupted request", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enter(page);
  await page.getByLabel("Switch demo profile").selectOption("runner");
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
  await expect(
    page.getByRole("combobox", { name: "Transportation", exact: true }),
  ).toBeVisible();

  let release!: () => void;
  let calls = 0;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/runner", async (route) => {
    calls++;
    await held;
    await route.fulfill({
      status: 503,
      json: { error: "LOCAL TEST: runner update interrupted. Try again." },
    });
  });
  try {
    await page
      .getByRole("button", { name: "Available for the next hour" })
      .click();
    await expect(
      page.getByRole("button", { name: "End availability" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("combobox", { name: "Transportation", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByText("LOCAL TEST: runner update interrupted. Try again."),
  ).toBeVisible();
  expect(calls).toBe(1);
  await page.unroute("**/api/runner");
  await page
    .getByRole("button", { name: "Available for the next hour" })
    .click();
  await expect(
    page.getByText(
      "Available for one hour. Your public location is coarsened.",
    ),
  ).toBeVisible();

  const tripHeld = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/runner", async (route) => {
    calls++;
    await tripHeld;
    await route.fulfill({
      status: 503,
      json: { error: "LOCAL TEST: trip update interrupted. Try again." },
    });
  });
  try {
    await page.getByRole("button", { name: "Share trip for one hour" }).click();
    await expect(
      page.getByRole("button", { name: "Share trip for one hour" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("combobox", {
        name: "I’m already going to…",
        exact: true,
      }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByText("LOCAL TEST: trip update interrupted. Try again."),
  ).toBeVisible();
  expect(calls).toBe(2);
  await page.unroute("**/api/runner");
  await page.getByRole("button", { name: "Share trip for one hour" }).click();
  await expect(
    page.getByText(
      "Trip intention shared for one hour. Exact location is private.",
    ),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("quantity stays within the server limit and empty map storefronts remain usable", async ({
  page,
  context,
}) => {
  await enter(page);
  const ticket = (await context.cookies()).find(
    (cookie) => cookie.name === "ltr_demo_ticket",
  )!;
  const session = await service
    .from("demo_sessions")
    .select("workspace_id")
    .eq("token_hash", createHash("sha256").update(ticket.value).digest("hex"))
    .single();
  expect(session.error).toBeNull();
  const bakery = await service
    .from("vendors")
    .select("id")
    .eq("demo_workspace", session.data!.workspace_id)
    .eq("name", "Demo Hearth Bakery")
    .single();
  expect(bakery.error).toBeNull();
  const listing = await service
    .from("listings")
    .update({ inventory: 25 })
    .eq("vendor_id", bakery.data!.id)
    .eq("title", "Habanero Cinnamon Rolls")
    .select("id")
    .single();
  expect(listing.error).toBeNull();
  await page.reload();
  await page
    .getByRole("textbox", { name: "Search listings" })
    .fill("Habanero Cinnamon Rolls");
  await page
    .locator(".cards .product")
    .filter({ hasText: "Habanero Cinnamon Rolls" })
    .click();
  const dialog = page.getByRole("dialog");
  for (let quantity = 1; quantity < 20; quantity++)
    await dialog.getByRole("button", { name: "Increase quantity" }).click();
  await expect(
    dialog.getByRole("button", { name: "Increase quantity" }),
  ).toBeDisabled();
  await expect(dialog.locator(".quantity")).toContainText("20");
  await expect(dialog.locator(".quantity")).toContainText("$90.00");
  await dialog.getByRole("button", { name: "Decrease quantity" }).click();
  await expect(
    dialog.getByRole("button", { name: "Increase quantity" }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  expect(
    (
      await service
        .from("listings")
        .update({ inventory: 0 })
        .eq("vendor_id", bakery.data!.id)
    ).error,
  ).toBeNull();
  await page.reload();
  await page
    .getByRole("button", { name: "Demo Hearth Bakery (demo)", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Viewing Demo Hearth Bakery")).toBeVisible();
  await expect(
    page.getByText("No finds yet. Try another category or a shorter search."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show all vendors", exact: true })
    .click();
  await expect(page.locator(".cards .product").first()).toBeVisible();
});

test("vendor listing creation locks duplicate submits and preserves a retry after failure", async ({
  page,
}) => {
  await enter(page);
  await page.getByLabel("Switch demo profile").selectOption("vendor");
  await expect(page.getByLabel("Switch demo profile")).toBeEnabled();
  await page.getByText("Add a listing", { exact: true }).click();
  const form = page.locator("form").filter({
    has: page.getByRole("button", { name: "Create listing", exact: true }),
  });
  const title = `LOCAL hardening listing ${randomUUID()}`;
  await form.getByLabel("Title", { exact: true }).fill(title);
  await form
    .getByLabel("Description", { exact: true })
    .fill("Fictional local regression fixture only.");
  let release!: () => void;
  let calls = 0;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/vendor", async (route) => {
    calls++;
    await held;
    await route.fulfill({
      status: 503,
      json: { error: "LOCAL TEST: listing save interrupted. Try again." },
    });
  });
  try {
    await form
      .getByRole("button", { name: "Create listing", exact: true })
      .click();
    await expect(
      form.getByRole("button", { name: "Create listing", exact: true }),
    ).toBeDisabled();
    await expect(
      form.getByRole("combobox", { name: "Your vendor", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(
    page.getByText("LOCAL TEST: listing save interrupted. Try again."),
  ).toBeVisible();
  expect(calls).toBe(1);
  await expect(form.getByLabel("Title", { exact: true })).toHaveValue(title);
  await page.unroute("**/api/vendor");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/vendor") &&
      response.request().method() === "POST",
  );
  await form
    .getByRole("button", { name: "Create listing", exact: true })
    .click();
  expect((await saved).status()).toBe(200);
  await expect(
    page.getByText("Saved. Refresh the dashboard to see your changes."),
  ).toBeVisible();
  const rows = await service.from("listings").select("id").eq("title", title);
  expect(rows.error).toBeNull();
  expect(rows.data).toHaveLength(1);
});

test("private documents use an explicit secure link and account network failures can be retried", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const email = `hardening-${randomUUID()}@local-town-runners.example`;
  const password = randomBytes(20).toString("base64url");
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(created.error).toBeNull();
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/account");
  const consent = page.locator(".consent-form");
  await expect(consent).toBeVisible();
  for (const checkbox of await consent.getByRole("checkbox").all())
    await checkbox.check();
  await consent
    .getByLabel("Typed full name")
    .fill("LOCAL UI hardening applicant");
  await consent
    .getByRole("button", { name: "Submit agreement", exact: true })
    .click();
  await expect(consent).toHaveCount(0);
  await page.route("**/api/onboarding/documents?*", (route) =>
    route.fulfill({
      json: {
        url: "http://127.0.0.1:3000/LOCAL-TEST-ONLY-private-agreement.pdf",
        expiresIn: 60,
      },
    }),
  );
  await page
    .getByRole("button", {
      name: "Prepare private agreement PDF link",
      exact: true,
    })
    .click();
  const secureLink = page.getByRole("link", {
    name: "Open private agreement PDF in a new tab",
    exact: true,
  });
  await expect(secureLink).toHaveAttribute(
    "href",
    /LOCAL-TEST-ONLY-private-agreement.pdf$/,
  );
  await expect(secureLink).toHaveAttribute("target", "_blank");
  await expect(secureLink).toHaveAttribute("rel", "noopener noreferrer");

  await page.route("**/api/auth", (route) => route.abort("failed"));
  await page
    .getByRole("button", { name: "Sign out of this session", exact: true })
    .click();
  await expect(page.getByText("Sign-out failed. Try again.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign out of this session", exact: true }),
  ).toBeEnabled();
  await page.unroute("**/api/auth");
  await page
    .getByRole("button", { name: "Sign out of this session", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.route("**/api/auth", (route) => route.abort("failed"));
  const recover = page.getByRole("button", {
    name: "Request password recovery email",
    exact: true,
  });
  await recover.click();
  await expect(page.getByRole("status")).not.toBeEmpty();
  await expect(recover).toBeEnabled();
  await page.unroute("**/api/auth");
  // A local response fixture proves the browser can retry without sending email.
  await page.route("**/api/auth", (route) =>
    route.fulfill({
      json: { message: "LOCAL TEST: recovery request accepted." },
    }),
  );
  await recover.click();
  await expect(page.getByRole("status")).toHaveText(
    "LOCAL TEST: recovery request accepted.",
  );
  expect(errors).toEqual([]);
});
