import { test } from "node:test";
import assert from "node:assert/strict";
import { executeTool } from "../src/lib/ai-tools";
import { listings, vendors } from "../src/lib/catalog";
import { demoRunners } from "../src/lib/runners";
const context = {
  listings,
  vendors,
  runners: demoRunners(),
  authenticated: false,
};
test("AI cannot invoke privileged tools, prepare anonymously or read another order", () => {
  assert.throws(() =>
    executeTool("grantAdmin", { userId: "attacker" }, context),
  );
  assert.throws(() =>
    executeTool(
      "prepareOrder",
      { listingId: "listing-1", quantity: 2 },
      context,
    ),
  );
  assert.throws(() =>
    executeTool(
      "getOrderStatus",
      { orderId: "00000000-0000-4000-8000-000000000001" },
      { ...context, authenticated: true },
    ),
  );
});
test("AI validates identifiers and derives quotes from actual catalog prices", () => {
  assert.throws(() =>
    executeTool(
      "prepareOrder",
      { listingId: "listing-1", quantity: 2, totalCents: 1 },
      { ...context, authenticated: true },
    ),
  );
  assert.throws(() =>
    executeTool("getListingAvailability", { listingId: "invented" }, context),
  );
  const quote = executeTool(
    "prepareOrder",
    { listingId: "listing-1", quantity: 2 },
    { ...context, authenticated: true },
  );
  assert.equal(quote.prepared?.totalCents, 900);
  assert.match(quote.text, /quote only/);
});
test("AI excludes unavailable listings and explains existing trips", () => {
  const result = executeTool(
    "searchListings",
    { query: "", category: "Food", maxPriceCents: 2500 },
    {
      ...context,
      listings: listings.map((l) => ({ ...l, active: l.id !== "listing-1" })),
    },
  );
  assert.ok(!result.listings.some((l) => l.id === "listing-1"));
  const match = executeTool(
    "findCompatibleRunners",
    { listingId: "listing-1" },
    context,
  );
  assert.equal(match.matchedRunnerId, "bryan");
  assert.match(match.text, /already heading/);
});
