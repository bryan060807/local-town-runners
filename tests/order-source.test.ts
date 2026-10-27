import { test } from "node:test";
import assert from "node:assert/strict";
import { orderStatusLabel } from "../src/lib/order-source";
import { executeTool } from "../src/lib/ai-tools";

test("authorized assistant status preserves simulated payment provenance", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const context = {
    authenticated: true,
    vendors: [],
    listings: [],
    runners: [],
  };
  const simulated = executeTool(
    "getOrderStatus",
    { orderId: id },
    {
      ...context,
      orders: {
        [id]: orderStatusLabel({ state: "PAID", demo_simulated: true }),
      },
    },
  );
  assert.match(simulated.text, /PAID.*simulated demo order; no PayPal charge/);
  const genuine = executeTool(
    "getOrderStatus",
    { orderId: id },
    {
      ...context,
      orders: {
        [id]: orderStatusLabel({ state: "PAID", demo_simulated: false }),
      },
    },
  );
  assert.match(genuine.text, /Order status: PAID\./);
  assert.doesNotMatch(genuine.text, /simulated|no PayPal charge/);
});
