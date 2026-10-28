import { test, expect, type Page } from "@playwright/test";
import { listings, vendors, money, type Listing } from "../src/lib/catalog";

test.setTimeout(60000);
test.use({ actionTimeout: 15000 });

function watchProtectedWrites(page: Page) {
  const requests: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      (request.method() !== "GET" &&
        /^\/api\/(orders|cart|prepare|checkout|capture|refunds|fulfillment|runner|reviews|inquiries|demo\/orders)(\/|$)/.test(
          path,
        )) ||
      path.startsWith("/api/internal/")
    )
      requests.push(request.method() + " " + path);
  });
  return requests;
}

async function selectedFind(page: Page): Promise<Listing> {
  const studio = page.getByRole("region", {
    name: "Neighborhood Connection",
    exact: true,
  });
  const selected = studio.getByRole("article", {
    name: "Selected find",
    exact: true,
  });
  await expect(selected).toBeVisible();
  const id = await selected.getAttribute("data-listing-id");
  const listing = listings.find((entry) => entry.id === id);
  expect(listing).toBeDefined();
  expect(listing!.active && listing!.inventory > 0).toBe(true);
  expect(listing!.mode).toBe("SELL");
  expect(vendors.some((vendor) => vendor.id === listing!.vendorId)).toBe(true);
  await expect(
    selected.getByRole("heading", { name: listing!.title, exact: true }),
  ).toBeVisible();
  await expect(selected.getByLabel("Item price", { exact: true })).toHaveText(
    money(listing!.price),
  );
  return listing!;
}

test("connection intents use available catalog finds and review opens the selected item without preparing an order", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const protectedWrites = watchProtectedWrites(page);
  await page.goto("/");
  const studio = page.getByRole("region", {
    name: "Neighborhood Connection",
    exact: true,
  });
  const intents = studio.getByRole("group", {
    name: "Choose a connection",
    exact: true,
  });
  for (const [name, check] of [
    [
      "A gift under $30",
      (listing: Listing) =>
        listing.category === "Gifts" && listing.price <= 3000,
    ],
    ["Something to eat", (listing: Listing) => listing.category === "Food"],
    ["Made nearby", (listing: Listing) => listing.local],
  ] as const) {
    const intent = intents.getByRole("button", { name, exact: true });
    await intent.click();
    await expect(intent).toHaveAttribute("aria-pressed", "true");
    const listing = await selectedFind(page);
    expect(check(listing)).toBe(true);
    await expect(studio).toContainText("Fictional vendor");

    const review = studio.getByRole("button", {
      name: "Review this find",
      exact: true,
    });
    await review.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(listing.title);
    await expect(dialog).toContainText(money(listing.price));
    await dialog.getByRole("button", { name: "Close details" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(review).toBeFocused();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(protectedWrites).toEqual([]);
  expect(errors).toEqual([]);
  const screenshot = info.outputPath("OFFLINE-STUDIO-catalog-preview.png");
  await studio.screenshot({ path: screenshot });
  await info.attach("OFFLINE-STUDIO-catalog-preview", {
    path: screenshot,
    contentType: "image/png",
  });
});

test("connection preview works with keyboard, reduced motion and no WebGL, and Sidekick reads the chosen item", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const protectedWrites = watchProtectedWrites(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
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
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good finds are still close by." }),
  ).toBeVisible();
  const studio = page.getByRole("region", {
    name: "Neighborhood Connection",
    exact: true,
  });
  const intents = studio.getByRole("group", {
    name: "Choose a connection",
    exact: true,
  });
  await intents
    .getByRole("button", { name: "A gift under $30", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  const food = intents.getByRole("button", {
    name: "Something to eat",
    exact: true,
  });
  await expect(food).toBeFocused();
  await page.keyboard.press("Space");
  await expect(food).toHaveAttribute("aria-pressed", "true");
  expect((await selectedFind(page)).category).toBe("Food");
  await page.keyboard.press("Tab");
  const local = intents.getByRole("button", {
    name: "Made nearby",
    exact: true,
  });
  await expect(local).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(local).toHaveAttribute("aria-pressed", "true");
  const options = studio
    .getByRole("group", { name: "Available finds", exact: true })
    .getByRole("button");
  expect(await options.count()).toBeGreaterThan(0);
  await options.last().focus();
  await page.keyboard.press("Space");
  await expect(options.last()).toHaveAttribute("aria-pressed", "true");
  const listing = await selectedFind(page);
  expect(listing.local).toBe(true);

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
  expect(response.request().postDataJSON().previousListing).toBe(listing.id);
  const result = await response.json();
  expect(result.listings.map((item: { id: string }) => item.id)).toEqual([
    listing.id,
  ]);
  await expect(page.locator(".assistant .mini-results")).toContainText(
    listing.title,
  );
  await expect(page.locator(".assistant .reply")).not.toContainText(
    "Looking around the neighborhood",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(protectedWrites).toEqual([]);
  expect(errors).toEqual([]);
  const screenshot = info.outputPath("OFFLINE-STUDIO-no-webgl-keyboard.png");
  await studio.screenshot({ path: screenshot });
  await info.attach("OFFLINE-STUDIO-no-webgl-keyboard", {
    path: screenshot,
    contentType: "image/png",
  });
});
