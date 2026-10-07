import { test, expect } from "@playwright/test";
test("signature discovery, recommendations and explicit order preview", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Good things. Close to home." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I'm hungry. What's good?" }).click();
  await expect(page.getByRole("status")).toContainText("demo kitchens");
  await page
    .getByRole("button", { name: /Habanero Cinnamon Rolls/ })
    .first()
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
  expect(errors).toEqual([]);
});
test("gift discovery, search empty state, and responsive layout", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "A birthday gift under $40" }).click();
  await expect(page.getByRole("status")).toContainText("under $40");
  await expect(
    page.getByRole("button", { name: /Hand-thrown ceramic mug/ }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gifts", exact: true }).click();
  await expect(page.locator(".cards .product")).toHaveCount(3);
  if (info.project.name === "desktop") {
    await page
      .getByRole("textbox", { name: "Search listings" })
      .fill("unobtainium");
    await expect(page.getByText("No finds yet.")).toBeVisible();
    await page.getByRole("textbox", { name: "Search listings" }).fill("");
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `docs/screenshots/${info.project.name}.png`,
    fullPage: true,
  });
});
test("malformed inputs and unconfigured payment never succeed", async ({
  request,
}) => {
  const bad = await request.post("/api/prepare", {
    data: { listingId: "listing-1", quantity: 2, price: 1 },
  });
  expect(bad.status()).toBe(400);
  const pay = await request.post("/api/checkout", {
    headers: { Origin: "https://evil.example" },
    data: { orderId: "00000000-0000-4000-8000-000000000001" },
  });
  expect(pay.status()).toBe(403);
  const webhook = await request.post("/api/webhooks/paypal", {
    data: { id: "forged", event_type: "PAYMENT.CAPTURE.COMPLETED" },
  });
  expect(webhook.status()).toBe(401);
});

test("Louisiana map tiles and the self-hosted worker load with commerce markers", async ({
  page,
}) => {
  const tile = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname.startsWith("/tiles/") && r.status() === 200,
  );
  const worker = page.waitForResponse(
    (r) => r.url().endsWith("/maplibre-worker.mjs") && r.status() === 200,
  );
  await page.goto("/");
  await worker;
  await tile;
  await expect(page.locator(".map-pin")).toHaveCount(18);
  await expect(page.locator(".map-error")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Riverbend Bakery (demo)", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Habanero Cinnamon Rolls",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
