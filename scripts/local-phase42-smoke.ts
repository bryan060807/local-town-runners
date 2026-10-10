// Real local PostgreSQL/PostgREST concurrency; provider fixtures never call PayPal.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { recoverPayment } from "../src/lib/server/payment-recovery";
import { paypal } from "../src/lib/server/paypal";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.startsWith("http://127.0.0.1:")) throw Error("Local-only test");
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const user = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);
const signed = await user.auth.signInWithPassword({
  email: "customer@local-town-runners.example",
  password: process.env.DEMO_SEED_PASSWORD!,
});
assert.equal(signed.error, null);
const listings = await user
  .from("listings")
  .select("id")
  .eq("active", true)
  .gt("inventory", 4)
  .limit(1);
assert.equal(listings.error, null);
assert.ok(listings.data?.[0]);
const prepared = await user.rpc("prepare_order", {
  listing_id: listings.data[0].id,
  qty: 1,
  request_key: randomUUID(),
  delivery_address: "Fictional local payment recovery fixture",
});
assert.equal(prepared.error, null);
const id = prepared.data.id;
const paypalId = "LOCAL-PROVIDER-" + randomUUID();
const bound = await service.rpc("attach_verified_paypal_order", {
  order_id: id,
  paypal_id: paypalId,
  customer_id: signed.data.user!.id,
});
assert.equal(bound.error, null);
const order = { id, paypalId, totalCents: Number(prepared.data.total_cents) };
const amount = {
  currency_code: "USD",
  value: (order.totalCents / 100).toFixed(2),
};
const captureId = "LOCAL-CAPTURE-" + randomUUID();
let providerCaptured = false,
  captures = 0;
const provider: typeof paypal = async (path, body) => {
  if (body !== undefined) {
    assert.ok(path.endsWith("/capture"));
    captures++;
    providerCaptured = true;
    throw Error("LOCAL MOCK timeout after successful capture");
  }
  return {
    id: paypalId,
    status: providerCaptured ? "COMPLETED" : "APPROVED",
    purchase_units: [
      {
        custom_id: id,
        amount,
        ...(providerCaptured
          ? {
              payments: {
                captures: [
                  {
                    id: captureId,
                    status: "COMPLETED",
                    amount,
                    final_capture: true,
                  },
                ],
              },
            }
          : {}),
      },
    ],
  };
};
const results = await Promise.all([
  recoverPayment(order, true, provider),
  recoverPayment(order, true, provider),
]);
assert.equal(captures, 1);
assert.ok(results.some((r) => r.payment.phase === "confirmed"));
await recoverPayment(order, false, provider);
const webhookReplay = await service.rpc("confirm_payment", {
  order_id: id,
  capture_id: captureId,
  event_id: "LOCAL-WEBHOOK-" + randomUUID(),
  amount_cents: order.totalCents,
});
assert.equal(webhookReplay.error, null);
const o = await service
  .from("orders")
  .select("state,paypal_capture_id")
  .eq("id", id)
  .single();
assert.equal(o.data?.state, "PAID");
assert.equal(o.data?.paypal_capture_id, captureId);
const ledger = await service
  .from("ledger")
  .select("kind,simulated")
  .eq("order_id", id);
assert.equal(ledger.data?.length, 4);
assert.equal(
  ledger.data
    ?.filter((l) => l.kind !== "CUSTOMER_PAYMENT")
    .every((l) => l.simulated),
  true,
);
const claim = await service.rpc("claim_payment_capture", {
  order_id: id,
  paypal_id: paypalId,
});
assert.equal(claim.error, null);
assert.equal(claim.data, false); // Already paid cannot obtain a new capture claim.
const recovery = await service
  .from("payment_recovery")
  .select("capture_attempted_at,phase")
  .eq("order_id", id)
  .single();
assert.ok(recovery.data?.capture_attempted_at); // Observation refresh must not erase the financial-attempt boundary.
assert.equal(recovery.data?.phase, "confirmed");
const uncertain = await user.rpc("prepare_order", {
  listing_id: listings.data[0].id,
  qty: 1,
  request_key: randomUUID(),
  delivery_address: "Fictional local uncertain capture fixture",
});
assert.equal(uncertain.error, null);
const uncertainId = uncertain.data.id,
  uncertainPaypal = "LOCAL-UNCERTAIN-" + randomUUID();
assert.equal(
  (
    await service.rpc("attach_verified_paypal_order", {
      order_id: uncertainId,
      paypal_id: uncertainPaypal,
      customer_id: signed.data.user!.id,
    })
  ).error,
  null,
);
assert.equal(
  (
    await service.rpc("claim_payment_capture", {
      order_id: uncertainId,
      paypal_id: uncertainPaypal,
    })
  ).data,
  true,
);
const uncertainOrder = {
  id: uncertainId,
  paypalId: uncertainPaypal,
  totalCents: Number(uncertain.data.total_cents),
};
const uncertainProvider: typeof paypal = async (_path, body) => {
  assert.equal(
    body,
    undefined,
    "An uncertain prior attempt must never invoke another capture",
  );
  return {
    id: uncertainPaypal,
    status: "APPROVED",
    purchase_units: [
      {
        custom_id: uncertainId,
        amount: {
          currency_code: "USD",
          value: (uncertainOrder.totalCents / 100).toFixed(2),
        },
      },
    ],
  };
};
assert.equal(
  (await recoverPayment(uncertainOrder, false, uncertainProvider)).payment
    .phase,
  "review",
);
assert.equal(
  (await recoverPayment(uncertainOrder, true, uncertainProvider)).payment.phase,
  "review",
);
console.log(
  "Local recovery passed: concurrent requests made one mocked capture; timeout recovered by canonical read; repeated/manual/webhook confirmation made exactly four ledger entries; attempt boundary persisted. No PayPal request.",
);
