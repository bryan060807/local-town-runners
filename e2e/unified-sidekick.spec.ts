import { test, expect } from "@playwright/test";

test.setTimeout(60000);
test.use({ actionTimeout: 15000 });

test("one Sidekick preserves planning and discovery drafts while map shortcuts only focus its existing composer", async ({
  page,
  baseURL,
}, info) => {
  expect(baseURL).toBe("http://127.0.0.1:3000");
  const errors: string[] = [];
  const protectedWrites: string[] = [];
  const providerRequests: string[] = [];
  let planRequests = 0;
  let discoveryRequests = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.method() !== "POST") return;
    const path = new URL(request.url()).pathname;
    if (path === "/api/assistant/plan") planRequests++;
    if (path === "/api/assistant") discoveryRequests++;
  });
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
  const sidekick = page.getByRole("region", {
    name: "Your local sidekick",
    exact: true,
  });
  const planTool = sidekick.getByRole("button", {
    name: "Plan an errand",
    exact: true,
  });
  const discoveryTool = sidekick.getByRole("button", {
    name: "Find & ask",
    exact: true,
  });
  const planner = sidekick.getByRole("region", {
    name: "Sidekick Errand Planner",
    exact: true,
  });
  const planInput = planner.getByRole("textbox", {
    name: "Tell Sidekick what you need",
    exact: true,
  });
  const discoveryInput = sidekick.getByRole("textbox", {
    name: "Ask your local sidekick",
    exact: true,
  });
  await expect(sidekick).toHaveCount(1);
  await expect(page.locator(".explore-grid .assistant")).toHaveCount(0);
  await expect(sidekick.getByRole("textbox")).toHaveCount(1);
  await expect(planTool).toHaveAttribute("aria-pressed", "true");
  const initialDraft = "I need something locally made under $20.";
  await planInput.fill(initialDraft);
  await planner.getByLabel("Total budget (USD, optional)").fill("20");
  await planner.getByLabel("Locally made only", { exact: true }).check();

  await discoveryTool.click();
  await expect(discoveryTool).toHaveAttribute("aria-pressed", "true");
  await expect(sidekick.getByRole("textbox")).toHaveCount(1);
  await expect(planner).not.toBeVisible();
  const quickDraft = "Who has cinnamon rolls?";
  await discoveryInput.fill(quickDraft);
  await planTool.click();
  await expect(sidekick.getByRole("textbox")).toHaveCount(1);
  await expect(planInput).toHaveValue(initialDraft);
  await expect(planner.getByLabel("Total budget (USD, optional)")).toHaveValue(
    "20",
  );
  await expect(
    planner.getByLabel("Locally made only", { exact: true }),
  ).toBeChecked();
  expect(planRequests).toBe(0);
  expect(discoveryRequests).toBe(0);

  const planned = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/assistant/plan" &&
      response.request().method() === "POST",
  );
  await planner
    .getByRole("button", { name: "Build an errand plan", exact: true })
    .click();
  expect((await planned).status()).toBe(200);
  await expect(planner.locator('[data-plan-status="catalog"]')).toBeVisible();
  await expect(planner).toContainText("Catalog suggestions — AI unavailable");
  const followupDraft = "Actually, just show the cinnamon rolls.";
  await planInput.fill(followupDraft);

  // The map offers a navigation shortcut to the same mounted assistant. It
  // must not turn an unfinished draft into an automatic provider/API request.
  await page
    .getByRole("button", {
      name: "Ask Sidekick about this area",
      exact: true,
    })
    .click();
  await expect(discoveryTool).toHaveAttribute("aria-pressed", "true");
  await expect(sidekick.getByRole("textbox")).toHaveCount(1);
  await expect(discoveryInput).toBeFocused();
  await expect(discoveryInput).toHaveValue(quickDraft);
  expect(planRequests).toBe(1);
  expect(discoveryRequests).toBe(0);

  await planTool.click();
  await expect(sidekick.getByRole("textbox")).toHaveCount(1);
  await expect(planInput).toHaveValue(followupDraft);
  await expect(planner.locator('[data-plan-status="catalog"]')).toBeVisible();
  await expect(planner.getByLabel("Total budget (USD, optional)")).toHaveValue(
    "20",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const screenshot = info.outputPath("OFFLINE-UNIFIED-SIDEKICK-plan.png");
  await sidekick.screenshot({ path: screenshot });
  await info.attach("OFFLINE-UNIFIED-SIDEKICK-plan", {
    path: screenshot,
    contentType: "image/png",
  });
  expect(planRequests).toBe(1);
  expect(discoveryRequests).toBe(0);
  expect(protectedWrites).toEqual([]);
  expect(providerRequests).toEqual([]);
  expect(errors).toEqual([]);
});
