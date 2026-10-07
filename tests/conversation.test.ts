import { test } from "node:test";
import assert from "node:assert/strict";
import { conversationTool } from "../src/lib/conversation";
import { executeTool } from "../src/lib/ai-tools";
import { listings, vendors } from "../src/lib/catalog";
import { demoRunners, matchRunners } from "../src/lib/runners";
const context = {
  listings,
  vendors,
  runners: demoRunners(),
  authenticated: true,
};
test("signature conversation resolves current listing and prepares two without charging", () => {
  const hungry = executeTool(
    "searchListings",
    { query: "", category: "Food", maxPriceCents: 2500 },
    context,
  );
  assert.ok(hungry.listings.some((l) => l.title === "Habanero Cinnamon Rolls"));
  const details = conversationTool(
    "Wait. Habanero cinnamon rolls?",
    { resultIds: hungry.listings.map((l) => l.id) },
    listings,
  )!;
  const d = executeTool(details.name, details.args, context);
  const call = conversationTool(
    "Get me two",
    { selectedListingId: d.listings[0].id },
    listings,
  )!;
  const prepared = executeTool(call.name, call.args, context);
  assert.equal(prepared.prepared?.quantity, 2);
  assert.equal(prepared.prepared?.totalCents, 900);
  const runner = conversationTool(
    "Can anybody bring them?",
    { selectedListingId: d.listings[0].id },
    listings,
  )!;
  assert.equal(
    executeTool(runner.name, runner.args, context).matchedRunnerId,
    "bryan",
  );
  assert.equal(listings[0].inventory, 12);
});
test("gift follow-up retains category and budget while excluding non-local stock", () => {
  const custom = {
    ...context,
    listings: listings.map((l) => ({
      ...l,
      local: l.title.includes("ceramic"),
    })),
  };
  const first = conversationTool(
    "A birthday gift for my wife around $40",
    {},
    custom.listings,
  )!;
  const gift = executeTool(first.name, first.args, custom);
  const local = conversationTool(
    "Which one is actually made here?",
    { resultIds: gift.listings.map((l) => l.id) },
    custom.listings,
  )!;
  const answer = executeTool(local.name, local.args, custom);
  assert.equal(answer.listings.length, 1);
  assert.ok(answer.listings[0].local);
  assert.ok(answer.listings[0].price <= 4000);
});
test("stale or attacker-supplied conversational IDs cannot prepare arbitrary items", () => {
  assert.equal(
    conversationTool("Get me two", { selectedListingId: "unknown" }, listings),
    null,
  );
  assert.equal(
    conversationTool(
      "Get me two",
      { selectedListingId: listings[0].id },
      listings.map((l) => ({ ...l, inventory: 0 })),
    ),
    null,
  );
  assert.throws(() =>
    executeTool(
      "prepareOrder",
      { listingId: listings[0].id, quantity: 2 },
      { ...context, authenticated: false },
    ),
  );
});
test("runner matching excludes expired, overloaded, distant and incompatible candidates with stable explanations", () => {
  const now = 1000,
    base = demoRunners(now)[0];
  const candidates = [
    { ...base, id: "expired", until: now },
    { ...base, id: "busy", workload: 3 },
    { ...base, id: "far", area: [-90, 38] as [number, number] },
    { ...base, id: "wrong", categories: ["Farm"] },
    base,
  ];
  const ranked = matchRunners(
    candidates,
    vendors[0].coordinates,
    "Food",
    vendors[0].id,
    now,
  );
  assert.deepEqual(
    ranked.map((r) => r.id),
    ["bryan"],
  );
  assert.equal(ranked[0].approximateIncrementalMiles, 0);
  assert.match(ranked[0].explanation, /Delivery routing is not estimated/);
});
