import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sandboxAuthCheck,
  credentialCheck,
} from "../src/lib/paypal-diagnostics";
test("Sandbox diagnostics identify credential formatting without returning secrets", () => {
  assert.equal(credentialCheck(" key\n").outerWhitespace, true);
  assert.equal(credentialCheck('"key"').wrappedInQuotes, true);
  assert.equal(
    credentialCheck("PAYPAL_CLIENT_SECRET=key").looksLikeAssignment,
    true,
  );
  assert.equal(credentialCheck(undefined).present, false);
});
test("Sandbox diagnostics use production-shaped OAuth and never expose tokens or provider payloads", async () => {
  let url = "",
    headers: Headers | undefined;
  const transport = (async (u: unknown, init: RequestInit) => {
    url = String(u);
    headers = new Headers(init.headers);
    return Response.json({ access_token: "UNIT-TOKEN", extra: "UNIT-SECRET" });
  }) as typeof fetch;
  const r = await sandboxAuthCheck("UNIT-CLIENT", "UNIT-SECRET", transport);
  assert.equal(url, "https://api-m.sandbox.paypal.com/v1/oauth2/token");
  assert.equal(
    headers?.get("authorization"),
    "Basic " + Buffer.from("UNIT-CLIENT:UNIT-SECRET").toString("base64"),
  );
  assert.equal(r.outcome, "authenticated");
  assert.ok(!JSON.stringify(r).includes("UNIT-SECRET"));
  assert.ok(!JSON.stringify(r).includes("UNIT-TOKEN"));
});
test("Sandbox diagnostics distinguish rejected credentials from connectivity and missing settings", async () => {
  const rejected = (async () =>
    Response.json(
      { error: "invalid_client", error_description: "PRIVATE PROVIDER DATA" },
      { status: 401, headers: { "paypal-debug-id": "UNIT-DEBUG" } },
    )) as typeof fetch;
  const r = await sandboxAuthCheck("UNIT", "SECRET", rejected);
  assert.equal(r.httpStatus, 401);
  assert.equal(r.errorCode, "invalid_client");
  assert.equal(r.debugId, "UNIT-DEBUG");
  assert.ok(!JSON.stringify(r).includes("PRIVATE PROVIDER DATA"));
  const fail = (async () => {
    throw Error("SECRET");
  }) as typeof fetch;
  assert.equal(
    (await sandboxAuthCheck("UNIT", "SECRET", fail)).outcome,
    "network_or_invalid_response",
  );
  assert.equal(
    (await sandboxAuthCheck(undefined, "SECRET", fail)).outcome,
    "missing_configuration",
  );
});
