import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validCapture,
  paymentMatchesOrder,
  validWebhookCertificate,
  sandboxApprovalUrl,
  validRefund,
} from "../src/lib/payment-validation";
test("browser approval, pending captures and mismatched currency are not payment proof", () => {
  assert.equal(validCapture({ status: "APPROVED" }, 900), false);
  assert.equal(
    validCapture(
      { status: "COMPLETED", amount: { currency_code: "EUR", value: "9.00" } },
      900,
    ),
    false,
  );
  assert.equal(
    validCapture(
      { status: "COMPLETED", amount: { currency_code: "USD", value: "0.01" } },
      900,
    ),
    false,
  );
  assert.equal(
    validCapture(
      { status: "COMPLETED", amount: { currency_code: "USD", value: "9.00" } },
      900,
    ),
    true,
  );
  // Sandbox signatures may reference the shared PayPal API certificate host.
  for (const host of [
    "api.paypal.com",
    "api.sandbox.paypal.com",
    "api-m.paypal.com",
    "api-m.sandbox.paypal.com",
  ])
    assert.equal(
      validWebhookCertificate(
        `https://${host}/v1/notifications/certs/CERT-360caa42-fca2a594-567319a3`,
      ),
      true,
    );
});
test("payment belongs to the persisted order, not an attacker supplied order", () => {
  assert.equal(
    paymentMatchesOrder(
      { id: "P1", purchase_units: [{ custom_id: "O1" }] },
      "O1",
      "P1",
    ),
    true,
  );
  assert.equal(
    paymentMatchesOrder(
      { id: "P1", purchase_units: [{ custom_id: "O2" }] },
      "O1",
      "P1",
    ),
    false,
  );
});
test("webhook certificate URLs cannot inject arbitrary destinations", () => {
  assert.equal(
    validWebhookCertificate(
      "https://api.sandbox.paypal.com/v1/notifications/certs/test",
    ),
    true,
  );
  for (const u of [
    "http://api.paypal.com/a",
    "https://api.paypal.com.evil.test/a",
    "https://evil.test/a",
    "https://u:p@api.paypal.com/a",
    "https://api.sandbox.paypal.com:444/v1/notifications/certs/test",
    "https://api.sandbox.paypal.com/v1/oauth2/token",
    "https://api.sandbox.paypal.com/v1/notifications/certs/test?redirect=elsewhere",
    "https://api.sandbox.paypal.com/v1/notifications/certs/test#fragment",
    "garbage",
  ])
    assert.equal(validWebhookCertificate(u), false);
});

test("checkout approval stays on Sandbox PayPal and matches the persisted provider order", () => {
  const payment = (href: unknown) => ({
    links: [{ rel: "payer-action", href }],
  });
  const expected = "https://www.sandbox.paypal.com/checkoutnow?token=ORDER";
  assert.equal(sandboxApprovalUrl(payment(expected), "ORDER"), expected);
  for (const href of [
    "https://www.paypal.com/checkoutnow?token=ORDER",
    "https://www.sandbox.paypal.com.evil.test/checkoutnow?token=ORDER",
    "https://www.sandbox.paypal.com:444/checkoutnow?token=ORDER",
    "https://user:pass@www.sandbox.paypal.com/checkoutnow?token=ORDER",
    "http://www.sandbox.paypal.com/checkoutnow?token=ORDER",
    "https://www.sandbox.paypal.com/checkoutnow?token=OTHER",
    "https://www.sandbox.paypal.com/checkoutnow?token=ORDER&token=OTHER",
    "https://www.sandbox.paypal.com/checkoutnow",
    "not a url",
    null,
  ])
    assert.equal(sandboxApprovalUrl(payment(href), "ORDER"), null);
  for (const value of [null, {}, { links: null }, { links: [null, {}] }])
    assert.equal(sandboxApprovalUrl(value, "ORDER"), null);
});

test("refund proof uses exact decimal cents and rejects fractional cents, non-USD or pending funds", () => {
  const refund = {
    id: "REFUND",
    status: "COMPLETED",
    amount: { currency_code: "USD", value: "4.50" },
  };
  for (const value of ["4.5", "4.50"])
    assert.equal(
      validRefund({ ...refund, amount: { ...refund.amount, value } }, 450),
      true,
    );
  for (const value of ["4.501", "4.51", "4.5e0", " 4.50"])
    assert.equal(
      validRefund({ ...refund, amount: { ...refund.amount, value } }, 450),
      false,
    );
  assert.equal(validRefund({ ...refund, status: "PENDING" }, 450), false);
  assert.equal(
    validRefund(
      { ...refund, amount: { ...refund.amount, currency_code: "EUR" } },
      450,
    ),
    false,
  );
  assert.equal(validRefund(refund, Number.NaN), false);
  assert.equal(validRefund(null, 450), false);
});

test("an attacker-associated PayPal order is never captured, and completed retries never recapture", async () => {
  const { reconcileOwnedCapture } =
    await import("../src/lib/payment-validation");
  let calls = 0;
  const order = { id: "LOCAL", paypalId: "PAYPAL", totalCents: 900 };
  await assert.rejects(() =>
    reconcileOwnedCapture(order, {
      read: async () => ({
        id: "PAYPAL",
        status: "APPROVED",
        purchase_units: [{ custom_id: "OTHER" }],
      }),
      capture: async () => {
        calls++;
        return {};
      },
    }),
  );
  assert.equal(calls, 0);
  await assert.rejects(() =>
    reconcileOwnedCapture(order, {
      read: async () => ({
        id: "PAYPAL",
        status: "APPROVED",
        purchase_units: [
          {
            custom_id: "LOCAL",
            amount: { currency_code: "USD", value: "1.00" },
          },
        ],
      }),
      capture: async () => {
        calls++;
        return {};
      },
    }),
  );
  assert.equal(calls, 0);
  const completed = {
    id: "PAYPAL",
    status: "COMPLETED",
    purchase_units: [
      {
        custom_id: "LOCAL",
        amount: { currency_code: "USD", value: "9.00" },
        payments: {
          captures: [
            {
              id: "CAPTURE",
              status: "COMPLETED",
              amount: { currency_code: "USD", value: "9.00" },
            },
          ],
        },
      },
    ],
  };
  const result = await reconcileOwnedCapture(order, {
    read: async () => completed,
    capture: async () => {
      calls++;
      return completed;
    },
  });
  assert.equal(result.phase, "captured");
  assert.equal(result.captureId, "CAPTURE");
  assert.equal(calls, 0);
});
