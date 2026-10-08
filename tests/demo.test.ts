import { test } from "node:test";
import assert from "node:assert/strict";
import { demoProducts, demoShops, demoRoles } from "../src/lib/demo-catalog";
import {
  sealDemoCredentials,
  openDemoCredentials,
  demoTokenHash,
} from "../src/lib/demo-crypto";
import { validRefund } from "../src/lib/payment-validation";
test("demo catalog contains 25 fictional products, ten primary products, and quote-only services", () => {
  assert.equal(demoProducts.length, 25);
  assert.equal(demoProducts.filter((x) => x.shop === 0).length, 10);
  assert.equal(demoShops.length, 4);
  assert.deepEqual(demoRoles, ["customer", "vendor", "runner"]);
  assert.ok(demoProducts.some((x) => x.secondhand));
  assert.ok(demoProducts.some((x) => x.local));
  assert.ok(demoProducts.some((x) => x.mode === "MAKE"));
  assert.ok(demoProducts.some((x) => x.mode === "DO"));
});
test("demo credentials are encrypted and reject tampered values and different service keys", () => {
  const original = {
    customer: { email: "fictional@example.test", password: "secret" },
  };
  const sealed = sealDemoCredentials(original, "test-key");
  assert.ok(!sealed.includes("secret"));
  assert.deepEqual(openDemoCredentials(sealed, "test-key"), original);
  assert.throws(() => openDemoCredentials(sealed, "different-key"));
  assert.throws(() => openDemoCredentials(sealed + "x", "test-key"));
  assert.equal(demoTokenHash("ticket").length, 64);
});
test("refund confirmation requires completed USD amount evidence", () => {
  assert.ok(
    validRefund(
      {
        id: "R",
        status: "COMPLETED",
        amount: { currency_code: "USD", value: "9.00" },
      },
      900,
    ),
  );
  assert.ok(
    !validRefund(
      {
        id: "R",
        status: "PENDING",
        amount: { currency_code: "USD", value: "9.00" },
      },
      900,
    ),
  );
  assert.ok(
    !validRefund(
      {
        id: "R",
        status: "COMPLETED",
        amount: { currency_code: "EUR", value: "9.00" },
      },
      900,
    ),
  );
});
