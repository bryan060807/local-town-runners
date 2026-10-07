import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validCapture,
  paymentMatchesOrder,
  validWebhookCertificate,
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
    "garbage",
  ])
    assert.equal(validWebhookCertificate(u), false);
});
