import { test, expect } from "@playwright/test";
import { listings, money } from "../src/lib/catalog";

test.setTimeout(60000);
test.use({ actionTimeout: 15000 });

test("offline planner identifies catalog fallback honestly and opens an actual suggestion without commerce writes", async ({
  page,
  baseURL,
}, info) => {
  expect(baseURL).toBe("http://127.0.0.1:3000");
  const errors: string[] = [];
  const protectedWrites: string[] = [];
  const providerRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (/(^|\.)(paypal\.com|openai\.com)$/.test(url.hostname)) {
      providerRequests.push(request.method() + " " + url.hostname);
      await route.abort();
    } else if (
      request.method() !== "GET" &&
      /^\/api\/(orders|cart|prepare|checkout|capture|refunds|payments|fulfillment|runner|reviews|inquiries|internal|demo\/orders)(\/|$)/.test(
        url.pathname,
      )
    ) {
      protectedWrites.push(request.method() + " " + url.pathname);
      await route.abort();
    } else await route.continue();
  });

  await page.goto("/");
  const planner = page.getByRole("region", {
    name: "Sidekick Errand Planner",
    exact: true,
  });
  await expect(planner).toContainText("Illustrative catalog");
  const message = "I need something locally made under $20.";
  await planner
    .getByRole("textbox", { name: "Tell Sidekick what you need", exact: true })
    .fill(message);
  await planner
    .getByLabel("Total budget (USD, optional)", { exact: true })
    .fill("20");
  await planner.getByLabel("Locally made only", { exact: true }).check();
  const planned = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/assistant/plan" &&
      response.request().method() === "POST",
  );
  await planner
    .getByRole("button", { name: "Build an errand plan", exact: true })
    .click();
  const response = await planned;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({
    message,
    turns: [],
    budgetCents: 2000,
    localOnly: true,
  });
  const result = await response.json();
  expect(result.status).toBe("catalog");
  expect(result.provenance).toEqual({
    engine: "catalog",
    reason: "not_configured",
    modelAttempts: 0,
  });
  expect(result.options).toEqual([]);
  expect(result.recommendedIndex).toBeNull();
  expect(result.budgetCents).toBe(2000);
  expect(result.suggestions.length).toBeGreaterThan(0);
  expect(result.suggestions.length).toBeLessThanOrEqual(4);
  expect(result.catalogCompared).toBe(listings.length);
  for (const suggestion of result.suggestions) {
    const current = listings.find((listing) => listing.id === suggestion.id);
    expect(current).toBeDefined();
    expect(suggestion).toEqual(current);
    expect(current!.mode).toBe("SELL");
    expect(current!.active && current!.inventory > 0 && current!.local).toBe(
      true,
    );
    expect(current!.price).toBeLessThanOrEqual(2000);
  }

  await expect(planner.locator('[data-plan-status="catalog"]')).toBeVisible();
  await expect(planner.locator('[data-engine="catalog"]')).toHaveText(
    "Catalog suggestions — AI unavailable",
  );
  await expect(planner).toContainText("not an AI-generated plan");
  await expect(
    planner.getByText("AI-assisted plan", { exact: true }),
  ).toHaveCount(0);
  await expect(
    planner.getByRole("article", { name: /^Plan option \d+$/ }),
  ).toHaveCount(0);
  await expect(
    planner.getByRole("button", {
      name: "Save these choices to cart",
      exact: true,
    }),
  ).toHaveCount(0);
  const suggestions = planner
    .locator('[aria-label="Catalog suggestions"]')
    .getByRole("button");
  await expect(suggestions).toHaveCount(result.suggestions.length);
  const first = result.suggestions[0];
  await expect(suggestions.nth(0)).toContainText(first.title);
  await expect(suggestions.nth(0)).toContainText(money(first.price));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const screenshot = info.outputPath("OFFLINE-PLANNER-catalog-fallback.png");
  await planner.screenshot({ path: screenshot });
  await info.attach("OFFLINE-PLANNER-catalog-fallback", {
    path: screenshot,
    contentType: "image/png",
  });

  await suggestions.nth(0).click();
  await expect(page).toHaveURL(`${baseURL}/listings/${first.id}?quantity=1`);
  await expect(
    page.getByRole("heading", { name: first.title, level: 1, exact: true }),
  ).toBeVisible();
  const choice = page.getByRole("region", {
    name: "Choose this item",
    exact: true,
  });
  await expect(choice).toContainText("illustrative catalog supports browsing");
  await expect(
    choice.getByRole("button", { name: "Add to cart", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(protectedWrites).toEqual([]);
  expect(providerRequests).toEqual([]);
  expect(errors).toEqual([]);
});
