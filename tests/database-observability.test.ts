import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseOperationError } from "../src/lib/server/errors";
test("Database operation context retains SQLSTATE but excludes private database errors", () => {
  const r = new DatabaseOperationError(
    {
      code: "P0001",
      message: "PRIVATE CONTACT",
      details: "PRIVATE APPLICATION",
      hint: "SECRET",
    },
    "submit_application",
  );
  assert.equal(r.code, "P0001");
  assert.equal(r.operation, "submit_application");
  assert.equal(r.message, "Database operation failed");
  assert.ok(!JSON.stringify(r).includes("PRIVATE"));
  assert.ok(!JSON.stringify(r).includes("SECRET"));
  const invalid = new DatabaseOperationError(
    { code: "PRIVATE BAD CODE" },
    "confirm_payment",
  );
  assert.equal(invalid.code, undefined);
});
