import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inspectOwnedPayment,
  reconcileOwnedCapture,
  PaymentValidationError,
} from "../src/lib/payment-validation";
import {
  confirmVerifiedPayment,
  paymentMessage,
} from "../src/lib/payment-recovery";
const order = { id: "LOCAL", paypalId: "PAYPAL", totalCents: 3500 };
const amount = { currency_code: "USD", value: "35.00" };
const approved = {
  id: "PAYPAL",
  status: "APPROVED",
  purchase_units: [{ custom_id: "LOCAL", amount }],
};
function captured(status = "COMPLETED") {
  return {
    ...approved,
    status: "COMPLETED",
    purchase_units: [
      {
        ...approved.purchase_units[0],
        payments: {
          captures: [
            {
              id: "CAPTURE",
              status,
              amount,
              final_capture: true,
              status_details: { reason: "ECHECK" },
            },
          ],
        },
      },
    ],
  };
}
test("pending eCheck is not completed capture and never authorizes a second capture", async () => {
  let calls = 0;
  const result = await reconcileOwnedCapture(order, {
    read: async () => captured("PENDING"),
    capture: async () => {
      calls++;
      return {};
    },
    claimCapture: async () => {
      calls++;
      return true;
    },
  });
  assert.equal(result.phase, "capture_pending");
  assert.equal(result.pendingReason, "ECHECK");
  assert.equal(calls, 0);
  assert.match(paymentMessage(result), /not completed yet/);
  assert.doesNotMatch(paymentMessage(result), /Payment received/);
});
test("read-only status distinguishes approval, awaiting approval, failure and missing capture", async () => {
  assert.equal(
    (await reconcileOwnedCapture(order, { read: async () => approved })).phase,
    "approved",
  );
  assert.equal(
    inspectOwnedPayment(order, { ...approved, status: "CREATED" }).phase,
    "awaiting_approval",
  );
  assert.equal(inspectOwnedPayment(order, captured("FAILED")).phase, "failed");
  assert.equal(
    inspectOwnedPayment(order, { ...approved, status: "COMPLETED" }).phase,
    "review",
  );
});
test("capture response may omit optional order metadata; fresh canonical GET remains mandatory", async () => {
  let reads = 0,
    financialCalls = 0;
  const result = await reconcileOwnedCapture(order, {
    read: async () => (++reads === 1 ? approved : captured()),
    claimCapture: async () => true,
    capture: async () => {
      financialCalls++;
      return {
        id: "PAYPAL",
        status: "COMPLETED",
        purchase_units: [{ payments: captured().purchase_units[0].payments }],
      };
    },
  });
  assert.equal(reads, 2);
  assert.equal(financialCalls, 1);
  assert.equal(result.captureId, "CAPTURE");
  assert.equal(result.phase, "captured");
});
test("completed capture is reusable without requesting another financial operation", async () => {
  let calls = 0;
  for (let i = 0; i < 3; i++) {
    const result = await reconcileOwnedCapture(order, {
      read: async () => captured(),
      claimCapture: async () => {
        calls++;
        return true;
      },
      capture: async () => {
        calls++;
        return {};
      },
    });
    assert.equal(result.phase, "captured");
  }
  assert.equal(calls, 0);
});
test("amount, currency, purchase-unit count and internal association stay mandatory before any capture", async () => {
  const invalid = [
    { ...approved, id: "OTHER" },
    {
      ...approved,
      purchase_units: [{ ...approved.purchase_units[0], custom_id: "OTHER" }],
    },
    {
      ...approved,
      purchase_units: [
        {
          ...approved.purchase_units[0],
          amount: { ...amount, value: "35.01" },
        },
      ],
    },
    {
      ...approved,
      purchase_units: [
        {
          ...approved.purchase_units[0],
          amount: { ...amount, currency_code: "EUR" },
        },
      ],
    },
    {
      ...approved,
      purchase_units: [...approved.purchase_units, ...approved.purchase_units],
    },
  ];
  let calls = 0;
  for (const p of invalid)
    await assert.rejects(
      () =>
        reconcileOwnedCapture(order, {
          read: async () => p,
          claimCapture: async () => {
            calls++;
            return true;
          },
          capture: async () => {
            calls++;
            return {};
          },
        }),
      PaymentValidationError,
    );
  assert.equal(calls, 0);
});
test("canonical capture requires one nonempty ID, exact USD amount and completed status", () => {
  for (const capture of [
    { id: "", status: "COMPLETED", amount },
    { status: "COMPLETED", amount },
    {
      id: "CAPTURE",
      status: "COMPLETED",
      amount: { ...amount, value: "1.00" },
    },
    {
      id: "CAPTURE",
      status: "COMPLETED",
      amount: { ...amount, currency_code: "EUR" },
    },
  ])
    assert.throws(
      () =>
        inspectOwnedPayment(order, {
          ...captured(),
          purchase_units: [
            {
              ...approved.purchase_units[0],
              payments: { captures: [capture] },
            },
          ],
        }),
      PaymentValidationError,
    );
  assert.throws(
    () =>
      inspectOwnedPayment(order, {
        ...captured(),
        purchase_units: [
          {
            ...approved.purchase_units[0],
            payments: {
              captures: [
                ...captured().purchase_units[0].payments.captures,
                ...captured().purchase_units[0].payments.captures,
              ],
            },
          },
        ],
      }),
    PaymentValidationError,
  );
  assert.equal(
    inspectOwnedPayment(order, captured("PENDING")).phase,
    "capture_pending",
  );
  assert.equal(
    inspectOwnedPayment(order, captured("REFUNDED")).phase,
    "review",
  );
  assert.equal(
    inspectOwnedPayment(order, { ...captured(), status: "APPROVED" }).phase,
    "review",
  );
});
test("decimal amount representation is exact and cannot use exponent, fractional cents or float rounding", () => {
  for (const value of ["35", "35.0", "35.00"])
    assert.equal(
      inspectOwnedPayment(order, {
        ...approved,
        purchase_units: [{ custom_id: "LOCAL", amount: { ...amount, value } }],
      }).phase,
      "approved",
    );
  for (const value of [
    "3.5e1",
    "35.001",
    " 35.00",
    "35.000000000000001",
    "35.01",
  ])
    assert.throws(
      () =>
        inspectOwnedPayment(order, {
          ...approved,
          purchase_units: [
            { custom_id: "LOCAL", amount: { ...amount, value } },
          ],
        }),
      PaymentValidationError,
    );
});
test("timeout after provider capture is recovered through GET without a second capture", async () => {
  let reads = 0,
    captures = 0;
  const result = await reconcileOwnedCapture(order, {
    read: async () => (++reads === 1 ? approved : captured()),
    claimCapture: async () => true,
    capture: async () => {
      captures++;
      throw Error("timeout");
    },
  });
  assert.equal(result.phase, "captured");
  assert.equal(captures, 1);
});
test("uncertain response and durable prior attempt never trigger another capture", async () => {
  let calls = 0;
  const first = await reconcileOwnedCapture(order, {
    read: async () => approved,
    claimCapture: async () => true,
    capture: async () => {
      calls++;
      throw Error("timeout");
    },
  });
  assert.equal(first.phase, "review");
  const second = await reconcileOwnedCapture(order, {
    read: async () => approved,
    claimCapture: async () => false,
    capture: async () => {
      calls++;
      return captured();
    },
  });
  assert.equal(second.category, "capture_already_attempted");
  assert.equal(calls, 1);
});
test("provider GET failure after capture stays uncertain; a mismatched response ID cannot become success", async () => {
  let reads = 0;
  const missing = await reconcileOwnedCapture(order, {
    read: async () => {
      if (++reads > 1) throw Error("timeout");
      return approved;
    },
    claimCapture: async () => true,
    capture: async () => ({ id: "PAYPAL" }),
  });
  assert.equal(missing.phase, "review");
  reads = 0;
  const mismatched = await reconcileOwnedCapture(order, {
    read: async () => (++reads === 1 ? approved : captured()),
    claimCapture: async () => true,
    capture: async () => ({ id: "OTHER" }),
  });
  assert.equal(mismatched.category, "capture_response_order");
});
test("database failure after successful capture preserves verified payment and retries only reconciliation", async () => {
  const verified = inspectOwnedPayment(order, captured());
  let confirmations = 0;
  const failed = await confirmVerifiedPayment(verified, async () => {
    confirmations++;
    throw Error("database offline");
  });
  assert.equal(failed.phase, "confirmation_pending");
  assert.match(paymentMessage(failed), /Payment received/);
  const recovered = await confirmVerifiedPayment(
    await reconcileOwnedCapture(order, { read: async () => captured() }),
    async (id) => {
      assert.equal(id, "CAPTURE");
      confirmations++;
    },
  );
  assert.equal(recovered.phase, "confirmed");
  assert.equal(confirmations, 2);
  await confirmVerifiedPayment(
    inspectOwnedPayment(order, captured("PENDING")),
    async () => {
      throw Error("must not confirm pending funds");
    },
  );
});
