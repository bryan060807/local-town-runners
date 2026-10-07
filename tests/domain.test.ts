import { test } from "node:test";
import assert from "node:assert/strict";
import { allocations, transition, prepareSchema } from "../src/lib/orders";
import { demoRunners, matchRunners } from "../src/lib/runners";
import { discover } from "../src/lib/assistant";
import { listings, vendors, searchListings } from "../src/lib/catalog";
test("allocations preserve every cent across uneven totals", () => {
  for (const n of [0, 1, 99, 1200, 99999]) {
    const a = allocations(n);
    assert.equal(a.vendor + a.runner + a.platform, n);
  }
  assert.throws(() => allocations(1.2));
  assert.throws(() => allocations(-1));
});
test("orders cannot jump into paid or delivered", () => {
  assert.throws(() => transition("DRAFT", "PAID"));
  assert.throws(() => transition("PAID", "DELIVERED"));
  assert.equal(transition("DELIVERED", "COMPLETED"), "COMPLETED");
});
test("input rejects browser price and mass assignment", () => {
  assert.equal(
    prepareSchema.safeParse({ listingId: "listing-1", quantity: 2, total: 1 })
      .success,
    false,
  );
  assert.equal(
    prepareSchema.safeParse({ listingId: "listing-1", quantity: -1 }).success,
    false,
  );
});
test("existing compatible trips preferred and expired runners excluded", () => {
  const now = 10000;
  const runners = demoRunners(now);
  const result = matchRunners(
    runners,
    vendors[0].coordinates,
    "Food",
    "vendor-1",
    now,
  );
  assert.equal(result[0].id, "bryan");
  assert.equal(result[0].existingTrip, true);
  assert.equal(
    matchRunners(
      runners,
      vendors[0].coordinates,
      "Food",
      "vendor-1",
      now + 7200000,
    ).length,
    0,
  );
  assert.equal(
    matchRunners(runners, vendors[0].coordinates, "Farm", "vendor-1", now).some(
      (r) => r.id === "bryan",
    ),
    false,
  );
});
test("signature discovery uses known catalog IDs and prices", () => {
  const r = discover("I'm hungry. What's good?");
  assert.ok(r.listings.some((l) => l.title === "Habanero Cinnamon Rolls"));
  const gift = discover("Birthday gift for my wife under $40");
  assert.ok(gift.listings.length > 0);
  assert.ok(gift.listings.every((l) => l.price <= 4000));
  assert.ok(r.listings.every((l) => listings.some((x) => x.id === l.id)));
});
test("unknown or unavailable stock is not invented", () => {
  assert.equal(searchListings("unobtainium").length, 0);
  const r = discover(
    "get me two",
    undefined,
    { listings: [], vendors: [] },
    [],
  );
  assert.equal(r.listings.length, 0);
});

test("browser location is coarsened before display and invalid GPS is rejected", async () => {
  const { coarsenCoordinates } = await import("../src/lib/location");
  assert.deepEqual(coarsenCoordinates(-91.051234, 39.448923), [-91.05, 39.45]);
  assert.throws(() => coarsenCoordinates(NaN, 39));
  assert.throws(() => coarsenCoordinates(181, 39));
});
