import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PaymentSummary from "../src/components/PaymentSummary";

const simulation = {
  id: "demo",
  state: "PAID",
  refund_state: "NONE",
  paypal_capture_id: null,
  demo_simulated: true,
};
const demoPayment = {
  order_id: "demo",
  kind: "DEMO_PAYMENT",
  amount_cents: 450,
  simulated: true,
};

test("simulation history cannot appear as a verified Sandbox capture", () => {
  const html = renderToStaticMarkup(
    createElement(PaymentSummary, {
      role: "customer",
      configured: true,
      orders: [simulation],
      ledger: [demoPayment],
    }),
  );
  assert.match(html, /DEMO SIMULATION/);
  assert.match(html, /Captured Sandbox payments: \$0\.00/);
  assert.match(html, /Simulated order value: \$4\.50/);
  assert.doesNotMatch(html, /Verified Sandbox capture/);
});

test("a genuine pending payment prevents a blanket no-charge simulation claim", () => {
  const html = renderToStaticMarkup(
    createElement(PaymentSummary, {
      role: "customer",
      configured: true,
      orders: [
        simulation,
        {
          id: "pending",
          state: "PENDING_PAYMENT",
          refund_state: "NONE",
          paypal_capture_id: null,
        },
      ],
      ledger: [demoPayment],
    }),
  );
  assert.match(html, /PAYPAL SANDBOX/);
  assert.doesNotMatch(html, /These orders use demo simulation/);
  assert.match(html, /Captured Sandbox payments: \$0\.00/);
});

test("mixed genuine and simulated payment totals remain separate", () => {
  const html = renderToStaticMarkup(
    createElement(PaymentSummary, {
      role: "customer",
      configured: true,
      orders: [
        simulation,
        {
          id: "real",
          state: "PAID",
          refund_state: "NONE",
          paypal_capture_id: "CAPTURE-VERIFIED",
        },
      ],
      ledger: [
        demoPayment,
        {
          order_id: "real",
          kind: "CUSTOMER_PAYMENT",
          amount_cents: 3500,
          simulated: false,
        },
      ],
    }),
  );
  assert.match(html, /Captured Sandbox payments: \$35\.00/);
  assert.match(html, /Simulated order value: \$4\.50/);
  assert.match(html, /Verified Sandbox capture/);
});

test("cancelled simulations retain history with no active value or pending payout", () => {
  const orders = [{ ...simulation, state: "CANCELLED" }];
  const customer = renderToStaticMarkup(
    createElement(PaymentSummary, {
      role: "customer",
      configured: true,
      orders,
      ledger: [demoPayment],
    }),
  );
  assert.match(customer, /Simulated order value: \$0\.00/);
  assert.match(customer, /Simulation canceled/);
  const runner = renderToStaticMarkup(
    createElement(PaymentSummary, {
      role: "runner",
      configured: true,
      orders,
      ledger: [
        {
          order_id: "demo",
          kind: "RUNNER_ALLOCATION",
          amount_cents: 67,
          simulated: true,
        },
      ],
    }),
  );
  assert.match(runner, /Pending allocations<\/small><strong>\$0\.00/);
  assert.match(runner, /Completed-order allocations<\/small><strong>\$0\.00/);
  assert.match(runner, /Actual payouts<\/small><strong>\$0\.00/);
  assert.match(runner, /\$0\.67.*Simulation canceled/);
});
