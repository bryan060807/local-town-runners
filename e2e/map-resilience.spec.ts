import { test, expect, type Page } from "@playwright/test";

test.setTimeout(60000);
test.use({ actionTimeout: 15000 });

async function withoutWebGL(page: Page) {
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
}

test("a browser without WebGL can still find vendors, ask the assistant and preview an order", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await withoutWebGL(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Good things. Close to home." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Good finds are still close by." }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => ({
      webgl: document.createElement("canvas").getContext("webgl2") === null,
      canvas2d: document.createElement("canvas").getContext("2d") !== null,
    })),
  ).toEqual({ webgl: true, canvas2d: true });
  await expect(
    page.getByText("We couldn’t load that just now.", { exact: true }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "Browse local vendors" }).click();
  await expect(page).toHaveURL(/#vendor-directory-heading$/);
  await expect(page.locator("#vendor-directory-heading")).toBeFocused();
  await expect(page.locator(".explore-vendor-card").first()).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search listings" })
    .fill("Habanero Cinnamon Rolls");
  await expect(page.locator(".cards .product")).toHaveCount(1);
  await expect(page.locator(".cards .product")).toContainText(
    "Habanero Cinnamon Rolls",
  );
  await page.getByRole("button", { name: "I'm hungry. What's good?" }).click();
  await expect(page.locator(".assistant .reply")).toContainText(
    "available options",
  );
  await page
    .locator(".mini-results")
    .getByRole("button", { name: /Habanero Cinnamon Rolls/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Increase quantity" }).click();
  await expect(dialog).toContainText("$9.00");
  await dialog.getByRole("button", { name: "Preview order" }).click();
  await expect(dialog.getByRole("status")).toContainText("Preview only");
  await expect(dialog.getByRole("status")).toContainText("$9.00");
  await dialog.getByRole("button", { name: "Close details" }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);

  await page.getByRole("textbox", { name: "Search listings" }).fill("");
  await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
  const screenshot = info.outputPath("unsupported-webgl-browsing.png");
  await page.screenshot({ path: screenshot, fullPage: false });
  await info.attach("unsupported-webgl-browsing", {
    path: screenshot,
    contentType: "image/png",
  });
});

test("unavailable map tiles leave the catalog usable and a later reload recovers the map", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/tiles/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".map-error")).toContainText(
    "Map tiles unavailable",
  );
  await expect(page.locator(".world-map canvas")).toBeVisible();
  await expect(page.locator(".explore-vendor-card").first()).toBeVisible();
  await page
    .getByRole("textbox", { name: "Search listings" })
    .fill("Habanero Cinnamon Rolls");
  await expect(page.locator(".cards .product")).toHaveCount(1);
  await page.locator(".cards .product").click();
  await expect(page.getByRole("dialog")).toContainText(
    "Habanero Cinnamon Rolls",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("We couldn’t load that just now.", { exact: true }),
  ).toHaveCount(0);

  await page.unroute("**/tiles/**");
  const healthyTile = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.startsWith("/tiles/") &&
      response.status() === 200,
  );
  await page.reload();
  await healthyTile;
  await expect(page.locator(".map-error")).toHaveCount(0);
  await expect(page.locator(".map-pin")).toHaveCount(18);
  await expect(
    page.getByRole("heading", { name: "Good things. Close to home." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
