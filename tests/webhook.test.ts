import { test } from "node:test";
import assert from "node:assert/strict";
import { processWebhook } from "../src/lib/webhook-processing";
const event = {
  id: "EVENT",
  event_type: "PAYMENT.CAPTURE.COMPLETED",
  resource: {
    id: "CAPTURE",
    supplementary_data: { related_ids: { order_id: "PAYPAL" } },
  },
};
const canonical = {
  id: "PAYPAL",
  status: "COMPLETED",
  purchase_units: [
    {
      custom_id: "ORDER",
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
test("webhook rejects spoofed signatures before database access", async () => {
  let reads = 0;
  const r = await processWebhook(event, {
    verify: async () => false,
    findOrder: async () => {
      reads++;
      return null;
    },
    canonical: async () => canonical,
    confirm: async () => {
      throw Error("must not confirm");
    },
  });
  assert.equal(r.status, 401);
  assert.equal(reads, 0);
});
test("verified event reconciles only canonical matching captured payment; database handles replay", async () => {
  let calls = 0;
  const services = {
    verify: async () => true,
    findOrder: async () => ({ id: "ORDER", total_cents: 900 }),
    canonical: async () => canonical,
    confirm: async () => {
      calls++;
    },
  };
  assert.equal((await processWebhook(event, services)).status, 200);
  assert.equal((await processWebhook(event, services)).status, 200);
  assert.equal(calls, 2);
  assert.equal(
    (
      await processWebhook(event, {
        ...services,
        canonical: async () => ({
          ...canonical,
          purchase_units: [
            { ...canonical.purchase_units[0], custom_id: "OTHER" },
          ],
        }),
      })
    ).status,
    409,
  );
  assert.equal(calls, 2);
});
test("simulator event with no application order requests retry and never creates payment", async () => {
  const r = await processWebhook(event, {
    verify: async () => true,
    findOrder: async () => null,
    canonical: async () => {
      throw Error("must not query");
    },
    confirm: async () => {
      throw Error("must not confirm");
    },
  });
  assert.equal(r.status, 503);
});

test("pending eCheck and out-of-order events never credit unsettled funds", async () => {
  let confirms = 0;
  const pending = {
    ...canonical,
    purchase_units: [
      {
        ...canonical.purchase_units[0],
        payments: {
          captures: [
            {
              ...canonical.purchase_units[0].payments.captures[0],
              status: "PENDING",
            },
          ],
        },
      },
    ],
  };
  const services = {
    verify: async () => true,
    findOrder: async () => ({ id: "ORDER", total_cents: 900 }),
    canonical: async () => pending,
    confirm: async () => {
      confirms++;
    },
  };
  assert.equal(
    (
      await processWebhook(
        { ...event, event_type: "PAYMENT.CAPTURE.PENDING" },
        services,
      )
    ).status,
    200,
  );
  assert.equal((await processWebhook(event, services)).status, 503);
  assert.equal(confirms, 0);
  assert.equal(
    (
      await processWebhook(
        { ...event, event_type: "PAYMENT.CAPTURE.PENDING" },
        { ...services, canonical: async () => canonical },
      )
    ).status,
    200,
  );
  assert.equal(confirms, 1);
});
test("webhook amount association and capture IDs cannot be taken from the event alone", async () => {
  let confirms = 0;
  const services = {
    verify: async () => true,
    findOrder: async () => ({ id: "ORDER", total_cents: 900 }),
    canonical: async () => canonical,
    confirm: async () => {
      confirms++;
    },
  };
  assert.equal(
    (
      await processWebhook(
        { ...event, resource: { ...event.resource, id: "OTHER" } },
        services,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await processWebhook(event, {
        ...services,
        canonical: async () => ({
          ...canonical,
          purchase_units: [
            {
              ...canonical.purchase_units[0],
              amount: { currency_code: "USD", value: "1.00" },
            },
          ],
        }),
      })
    ).status,
    409,
  );
  assert.equal(
    (await processWebhook({ ...event, id: "" }, services)).status,
    400,
  );
  assert.equal(confirms, 0);
});
