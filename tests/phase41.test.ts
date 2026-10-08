import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { consentPdf } from "../src/lib/onboarding/pdf";
import { sendApplicationEmail } from "../src/lib/onboarding/email";
import { verifyEmailWebhook } from "../src/lib/onboarding/webhook";
test("Phase 4.1 PDFs retain every legal clause and render products, currency and signature on identified pages", async () => {
  const dir = await mkdtemp(tmpdir() + "/ltr-pdf-");
  try {
    const sections = JSON.parse(
      await readFile("docs/agreements/vdpcp-2026-10-08.json", "utf8"),
    );
    const bytes = await consentPdf({
      id: "UNIT-SUBMISSION",
      kind: "vendor",
      version: "VDPCP-original-2026-10-08",
      source_sha256: "a".repeat(64),
      created_at: "2026-10-08T10:44:49Z",
      typed_name: "UNIT SIGNER",
      verified_email: "unit@example.invalid",
      text_snapshot: sections,
      signature: [
        [
          [10, 20],
          [200, 120],
        ],
      ],
      presentation: true,
      application: {
        name: "UNIT shop",
        representative: "UNIT SIGNER",
        phone: "TEST CONTACT",
        serviceArea: "Unit area",
        category: "Food",
        description: "Long text ".repeat(400),
        products: [
          {
            title: "Unit One",
            mode: "SELL",
            description: "First",
            priceCents: 450,
            inventory: 5,
            availability: "Weekdays",
          },
          {
            title: "Unit Two",
            mode: "MAKE",
            description: "Second",
            priceCents: 123456,
            inventory: 0,
            availability: "By appointment",
          },
        ],
      },
    });
    await writeFile(dir + "/test.pdf", bytes);
    execFileSync("pdftotext", [
      "-layout",
      dir + "/test.pdf",
      dir + "/test.txt",
    ]);
    const text = await readFile(dir + "/test.txt", "utf8");
    const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
    for (const section of sections) {
      assert.ok(normalize(text).includes(normalize(section.heading)));
      assert.ok(normalize(text).includes(normalize(section.text)));
    }
    for (const v of [
      "Completed Vendor Application",
      "Business Name",
      "Authorized Representative",
      "Unit One",
      "Unit Two",
      "$4.50",
      "$1,234.56",
      "Presentation copy",
    ])
      assert.ok(text.includes(v), v);
    assert.ok(text.split("\f")[0].includes("Drawn signature"));
    assert.ok(!text.includes('"priceCents"'));
    assert.ok(!text.includes('"products"'));
    for (const page of text.split("\f").slice(0, -1))
      assert.ok(page.trim().length > 30, "No blank or signature-only page");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("Phase 4.1 notification sends exact frozen payload to configured admin without storage URLs", async () => {
  const payload = {
    from: "Unit <unit@example.invalid>",
    to: ["aibrymusic@gmail.com"],
    subject: "Local Town Runners — New Vendor Application",
    text: "Submission UNIT. Sign in: https://example.invalid/admin/onboarding?q=UNIT",
  };
  let sent: unknown;
  const rawBodies: string[] = [];
  const transport = (async (_url: unknown, init: RequestInit) => {
    rawBodies.push(String(init.body));
    sent = JSON.parse(String(init.body));
    return Response.json({ id: "UNIT-RECEIPT" });
  }) as typeof fetch;
  const result = await sendApplicationEmail(
    {
      id: "UNIT",
      kind: "vendor",
      applicationId: "UNIT",
      adminUrl: "https://example.invalid/admin/onboarding",
      apiKey: "UNIT",
      from: "ignored",
      payload,
    },
    transport,
  );
  assert.deepEqual(sent, payload);
  assert.equal(result.providerId, "UNIT-RECEIPT");
  assert.equal(result.status, "accepted");
  await sendApplicationEmail(
    {
      id: "UNIT",
      kind: "vendor",
      applicationId: "UNIT",
      adminUrl: "https://example.invalid/admin/onboarding",
      apiKey: "UNIT",
      from: "ignored",
      payload: {
        text: payload.text,
        subject: payload.subject,
        to: payload.to,
        from: payload.from,
      },
    },
    transport,
  );
  assert.equal(
    rawBodies[0],
    rawBodies[1],
    "Database property order does not change the provider request",
  );
});
test("Phase 4.1 delivery webhooks reject forged bodies, old timestamps and unknown signatures", () => {
  const key = Buffer.alloc(32, 5),
    secret = "whsec_" + key.toString("base64"),
    now = Date.now(),
    time = String(Math.floor(now / 1000)),
    raw = '{"type":"email.delivered"}',
    id = "UNIT";
  const signature = createHmac("sha256", key)
    .update(`${id}.${time}.${raw}`)
    .digest("base64");
  const headers = new Headers({
    "svix-id": id,
    "svix-timestamp": time,
    "svix-signature": "v1," + signature,
  });
  assert.equal(verifyEmailWebhook(raw, headers, secret, now), true);
  assert.equal(verifyEmailWebhook(raw + " ", headers, secret, now), false);
  assert.equal(verifyEmailWebhook(raw, headers, secret, now + 301000), false);
  headers.set("svix-signature", "v2," + signature);
  assert.equal(verifyEmailWebhook(raw, headers, secret, now), false);
});
