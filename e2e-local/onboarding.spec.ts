import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
test.setTimeout(90000);
const env = Object.fromEntries(
  (await readFile(".local-backend/app.env", "utf8"))
    .trim()
    .split("\n")
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const origin = "http://127.0.0.1:3000";
async function fresh(page: import("@playwright/test").Page) {
  const email = `phase4-${randomUUID()}@local-town-runners.example`,
    password = randomBytes(20).toString("base64url");
  await page.goto("/login");
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account/);
  return { email, password };
}
async function acknowledge(
  page: import("@playwright/test").Page,
  draw = false,
) {
  const form = page.locator(".consent-form");
  await expect(form).toBeVisible();
  for (const checkbox of await form.getByRole("checkbox").all())
    await checkbox.check();
  await form.getByLabel("Typed full name").fill("LOCAL BROWSER TEST applicant");
  if (draw) {
    const pad = page.getByRole("application", {
      name: "Signature drawing area",
    });
    await pad.focus();
    await pad.press("Space");
    await pad.press("ArrowRight");
    await pad.press("ArrowDown");
    await pad.press("Space");
  }
  await form
    .getByRole("button", { name: "Submit agreement", exact: true })
    .click();
}
async function customerTerms(page: import("@playwright/test").Page) {
  await acknowledge(page);
  await expect(page.locator(".consent-form")).toHaveCount(0);
}
test("mobile customer registration, private preferences, consent PDF retry and unauthorized admin access", async ({
  page,
}) => {
  await fresh(page);
  await expect(
    page.getByText("Email verified", { exact: false }).first(),
  ).toBeVisible();
  await customerTerms(page);
  await page
    .getByLabel("Display name", { exact: true })
    .fill("LOCAL Browser customer");
  await page
    .getByRole("button", { name: "Save profile and privacy preferences" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved." }).last(),
  ).toBeVisible();
  await page.getByLabel("Address label").fill("UNIT delivery");
  await page
    .getByLabel("Private delivery address")
    .fill("LOCAL TEST PRIVATE ADDRESS");
  await page
    .getByLabel("Delivery instructions", { exact: true })
    .fill("Unit test instructions");
  await page.getByRole("button", { name: "Save private address" }).click();
  await expect(
    page.getByRole("heading", { name: "UNIT delivery" }),
  ).toBeVisible();
  const admin = await page.request.post("/api/admin/onboarding", {
    headers: { Origin: origin },
    data: { action: "suspend", userId: randomUUID(), suspended: true },
  });
  expect(admin.status()).toBe(403);
  await page.goto("/admin/onboarding");
  await expect(
    page.getByRole("heading", { name: "Administrator access required" }),
  ).toBeVisible();
  await page.goto("/account");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("mobile runner and vendor application drafts, actual signatures, immutable duplicate submissions and pending storage receipts", async ({
  page,
}) => {
  await fresh(page);
  await page.goto("/runner/apply");
  await page.getByLabel("Full name", { exact: true }).fill("LOCAL TEST runner");
  await page.getByLabel("Contact number").fill("000-TEST");
  await page
    .getByLabel("General service area")
    .fill("Fictional local test area");
  await page
    .getByLabel("About your delivery preferences")
    .fill("Local browser fixture only");
  await page.getByLabel("Normal travel areas").fill("Downtown test area");
  await page.getByLabel("Preferred pickup areas").fill("Town center");
  await page.getByLabel("Availability windows").fill("Weekday afternoons");
  await page
    .getByLabel("General route or trip preferences")
    .fill("Already-going bicycle test route");
  await page.getByLabel("I understand trip sharing").check();
  await page.getByRole("button", { name: "Save draft and continue" }).click();
  await expect(
    page.getByRole("heading", { name: "Runner Participation Agreement" }),
  ).toBeVisible();
  const submit = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/onboarding") &&
      r.request().postDataJSON()?.action === "submit",
  );
  await acknowledge(page, true);
  const response = await submit;
  expect(response.status()).toBe(200);
  const receipt = await response.json();
  expect(receipt.saved).toBe(true);
  expect(receipt.documentReady).toBe(false);
  await expect(
    page.getByRole("heading", { name: "Submission received" }),
  ).toBeVisible();
  const s = await service
    .from("agreement_submissions")
    .select("signature,application_id")
    .eq("id", receipt.submissionId)
    .single();
  expect(s.error).toBeNull();
  expect(s.data?.signature[0].length).toBeGreaterThan(1);
  const forged = await page.request.post("/api/admin/onboarding", {
    headers: { Origin: origin },
    data: {
      action: "review",
      applicationId: s.data?.application_id,
      decision: "approved",
      notes: "FORGED UNIT",
    },
  });
  expect(forged.status()).toBe(403);
  await page.goto("/vendor/apply");
  await page.getByLabel("Business or display name").fill("LOCAL TEST vendor");
  await page
    .getByLabel("Authorized representative")
    .fill("LOCAL TEST representative");
  await page.getByLabel("Contact number").fill("000-TEST");
  await page.getByLabel("General service area").fill("Fictional town");
  await page
    .getByLabel("Products or services description")
    .fill("Local browser test goods");
  await page.getByLabel("Title", { exact: true }).fill("LOCAL UNIT roll");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Browser test product only");
  await page.getByLabel("Price in cents", { exact: true }).fill("450");
  await page
    .getByLabel("Availability", { exact: true })
    .fill("Test appointment");
  await page.getByRole("button", { name: "Save draft and continue" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Vendor Demo Participation & Content Permission",
    }),
  ).toBeVisible();
  expect(await page.locator(".agreement-section").count()).toBe(12);
  await page.reload();
  await expect(page.getByLabel("Business or display name")).toHaveValue(
    "LOCAL TEST vendor",
  );
  await page.getByRole("button", { name: "Save draft and continue" }).click();
  await acknowledge(page, true);
  await expect(
    page.getByRole("heading", { name: "Submission received" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("actual local Auth token confirmation and recovery; administrator review retains rejected consent", async ({
  page,
  browser,
}) => {
  const email = `otp-${randomUUID()}@local-town-runners.example`,
    password = randomBytes(20).toString("base64url");
  const generated = await service.auth.admin.generateLink({
    type: "signup",
    email,
    password,
  });
  expect(generated.error).toBeNull();
  const hash = generated.data.properties?.hashed_token;
  expect(Boolean(hash)).toBe(true);
  await page.goto(
    `/auth/confirm?type=signup&token_hash=${encodeURIComponent(hash!)}`,
  );
  await expect(page).toHaveURL(/\/account/);
  await expect(page.getByText(`${email} · Email verified`)).toBeVisible();
  const recovered = await service.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  expect(recovered.error).toBeNull();
  await page.goto(
    `/auth/confirm?type=recovery&token_hash=${encodeURIComponent(recovered.data.properties!.hashed_token)}`,
  );
  await expect(page).toHaveURL(/\/recovery/);
  const newPassword = randomBytes(20).toString("base64url");
  await page.getByLabel("New password").fill(newPassword);
  await page
    .getByRole("button", { name: "Update password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Password updated");
  const payload = {
    name: "LOCAL OTP runner",
    phone: "000-TEST",
    serviceArea: "Fictional area",
    description: "Local OTP unit only",
    transportation: "Bicycle",
    availability: "Afternoons",
    radius: 5,
    maxDetour: 3,
    travelAreas: "Test downtown",
    pickupAreas: "Center",
    routePreferences: "Existing route only",
    deliveryTypes: ["Food"],
    eligibility: "Unverified",
    locationConsent: true,
  };
  const draft = await page.request.post("/api/onboarding", {
    headers: { Origin: origin },
    data: { action: "draft", role: "runner", payload },
  });
  expect(draft.status()).toBe(200);
  const { applicationId } = await draft.json();
  const agreement = await service
    .from("agreement_versions")
    .select("id")
    .eq("kind", "runner")
    .eq("active", true)
    .single();
  const submitted = await page.request.post("/api/onboarding", {
    headers: { Origin: origin },
    data: {
      action: "submit",
      applicationId,
      agreementId: agreement.data?.id,
      typedName: "LOCAL OTP applicant",
      signature: [
        [
          [10, 10],
          [40, 30],
        ],
      ],
      acknowledged: true,
      consent: true,
    },
  });
  expect(submitted.status()).toBe(200);
  const receipt = await submitted.json();
  const duplicate = await page.request.post("/api/onboarding", {
    headers: { Origin: origin },
    data: {
      action: "submit",
      applicationId,
      agreementId: agreement.data?.id,
      typedName: "LOCAL OTP applicant",
      signature: [
        [
          [10, 10],
          [40, 30],
        ],
      ],
      acknowledged: true,
      consent: true,
    },
  });
  expect((await duplicate.json()).submissionId).toBe(receipt.submissionId);
  const ctx = await browser.newContext();
  try {
    const admin = await ctx.newPage();
    await admin.goto(origin + "/login");
    await admin
      .getByLabel("Email", { exact: true })
      .fill("admin@local-town-runners.example");
    await admin
      .getByLabel("Password", { exact: true })
      .fill(env.DEMO_SEED_PASSWORD);
    await admin.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(admin).toHaveURL(/\/dashboard/);
    await admin.goto(origin + "/admin/onboarding?q=" + applicationId);
    const card = admin
      .locator("article.simple-card")
      .filter({ hasText: applicationId });
    await expect(card).toContainText("submitted");
    await card
      .getByLabel("Internal review notes")
      .fill("LOCAL TEST review; no live storage");
    await card
      .getByRole("button", { name: "Start review", exact: true })
      .click();
    await expect(card).toContainText("under review");
    await card
      .getByRole("button", { name: "Reject application", exact: true })
      .click();
    await expect(card).toContainText("rejected");
    const evidence = await service
      .from("agreement_submissions")
      .select("signature")
      .eq("id", receipt.submissionId)
      .single();
    expect(evidence.error).toBeNull();
    expect(evidence.data?.signature[0].length).toBe(2);
  } finally {
    await ctx.close();
  }
});
