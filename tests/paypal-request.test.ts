import { test } from "node:test";
import assert from "node:assert/strict";
import { sandboxPayPalRequest } from "../src/lib/paypal-request";
import { ProviderError } from "../src/lib/observability";

const credentials = { client: "UNIT-CLIENT", secret: "UNIT-SECRET" };

test("Sandbox transport fixes API origin, blocks redirects and preserves the capture idempotency key", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const transport = (async (url: unknown, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return calls.length === 1
      ? Response.json({ access_token: "UNIT-TOKEN" })
      : Response.json({ id: "ORDER", status: "COMPLETED" });
  }) as typeof fetch;
  const result = await sandboxPayPalRequest(
    credentials,
    "/v2/checkout/orders/ORDER/capture",
    {},
    "capture-LOCAL-ORDER",
    transport,
  );
  assert.equal(result.id, "ORDER");
  assert.equal(calls.length, 2);
  assert.equal(
    calls[0].url,
    "https://api-m.sandbox.paypal.com/v1/oauth2/token",
  );
  assert.equal(
    calls[1].url,
    "https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER/capture",
  );
  for (const { init } of calls) {
    assert.equal(init.redirect, "error");
    assert.equal(init.cache, "no-store");
    assert.ok(init.signal instanceof AbortSignal);
  }
  const headers = new Headers(calls[1].init.headers);
  assert.equal(headers.get("PayPal-Request-Id"), "capture-LOCAL-ORDER");
  assert.equal(headers.get("Authorization"), "Bearer UNIT-TOKEN");
});

test("invalid OAuth bodies stop before the order API and remain provider failures", async () => {
  for (const value of [
    null,
    [],
    {},
    { access_token: "" },
    { access_token: 1 },
  ]) {
    let calls = 0;
    const transport = (async () => {
      calls++;
      return Response.json(value);
    }) as typeof fetch;
    await assert.rejects(
      () =>
        sandboxPayPalRequest(
          credentials,
          "/v2/checkout/orders/ORDER",
          undefined,
          undefined,
          transport,
        ),
      (error: unknown) =>
        error instanceof ProviderError && error.stage === "oauth_response",
    );
    assert.equal(calls, 1);
  }
});

test("malformed successful upstream JSON is never classified as an invalid browser request", async () => {
  for (const invalid of [
    new Response("<html>unavailable</html>"),
    Response.json(null),
    Response.json([]),
  ]) {
    let calls = 0;
    const transport = (async () =>
      ++calls === 1
        ? Response.json({ access_token: "UNIT-TOKEN" })
        : invalid) as typeof fetch;
    await assert.rejects(
      () =>
        sandboxPayPalRequest(
          credentials,
          "/v2/checkout/orders/ORDER",
          undefined,
          undefined,
          transport,
        ),
      (error: unknown) =>
        error instanceof ProviderError && error.stage === "response",
    );
    assert.equal(calls, 2);
  }
});

test("OAuth rejection does not reach a payment API or expose provider error details", async () => {
  let calls = 0;
  const transport = (async () => {
    calls++;
    return Response.json(
      { error_description: "PRIVATE PROVIDER DETAILS" },
      { status: 401 },
    );
  }) as typeof fetch;
  await assert.rejects(
    () =>
      sandboxPayPalRequest(
        credentials,
        "/v2/checkout/orders/ORDER/capture",
        {},
        "capture-LOCAL-ORDER",
        transport,
      ),
    (error: unknown) =>
      error instanceof ProviderError &&
      error.stage === "oauth" &&
      error.status === 401 &&
      !error.message.includes("PRIVATE"),
  );
  assert.equal(calls, 1);
});

test("invalid or external API paths cannot send OAuth or bearer credentials", async () => {
  let calls = 0;
  const transport = (async () => {
    calls++;
    throw Error("No network request is expected");
  }) as typeof fetch;
  for (const path of [
    "https://api-m.paypal.com/v2/checkout/orders",
    "//evil.test/v2/checkout/orders",
    "@evil.test/v2/checkout/orders",
    "/v2/checkout/orders#fragment",
    "/other/path",
  ])
    await assert.rejects(
      () =>
        sandboxPayPalRequest(
          credentials,
          path,
          undefined,
          undefined,
          transport,
        ),
      (error: unknown) =>
        error instanceof ProviderError && error.stage === "request_path",
    );
  assert.equal(calls, 0);
});
