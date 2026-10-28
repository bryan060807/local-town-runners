import { test } from "node:test";
import assert from "node:assert/strict";
import type { Listing, Vendor } from "../src/lib/catalog";
import type { PublicRunner } from "../src/lib/map-types";
import { neighborhoodConnections } from "../src/lib/neighborhood-connections";

const now = 100000;
const vendor: Vendor = {
  id: "shop",
  name: "Fictional market",
  category: "Gifts",
  coordinates: [-91.05, 39.45],
  demo: true,
};
const gift: Listing = {
  id: "mug",
  vendorId: vendor.id,
  title: "Handmade River Mug",
  description: "Fictional local fixture",
  category: "Gifts",
  mode: "SELL",
  price: 2800,
  inventory: 2,
  local: true,
  active: true,
  emoji: "🏺",
};
const runner: PublicRunner = {
  id: "neighbor",
  name: "Fictional neighbor",
  area: [-91.05, 39.45],
  availableUntil: now + 60000,
  destinationVendorId: vendor.id,
  tripExpiresAt: now + 120000,
  demo: true,
};
const preview = (
  listings: Listing[] = [gift],
  runners: PublicRunner[] = [runner],
  vendors: Vendor[] = [vendor],
) =>
  neighborhoodConnections({ listings, vendors, runners, intent: "gift", now });

test("a gift preview uses the actual affordable item and a current declared shop trip", () => {
  const connections = preview([
    { ...gift, id: "too-expensive", price: 3200 },
    { ...gift, id: "card", title: "Greeting card", price: 800 },
    gift,
  ]);
  assert.deepEqual(
    connections.map(({ listing }) => [listing.id, listing.price]),
    [
      ["mug", 2800],
      ["card", 800],
    ],
  );
  assert.equal(connections[0].listing, gift);
  assert.equal(connections[0].vendor, vendor);
  assert.equal(connections[0].runner, runner);
  assert.equal(connections[0].tripUntil, runner.availableUntil);
  assert.equal("approximateMiles" in connections[0], false);
  assert.equal("arrival" in connections[0], false);
});

test("expired, unknown or invalid trip windows never become current runner candidates", () => {
  const invalid: PublicRunner[] = [
    { ...runner, availableUntil: now },
    { ...runner, availableUntil: now - 1 },
    { ...runner, availableUntil: NaN },
    { ...runner, availableUntil: Infinity },
    { ...runner, tripExpiresAt: now },
    { ...runner, tripExpiresAt: now - 1 },
    { ...runner, tripExpiresAt: undefined },
    { ...runner, tripExpiresAt: NaN },
    { ...runner, tripExpiresAt: Infinity },
  ];
  for (const candidate of invalid) {
    const [connection] = preview([gift], [candidate]);
    assert.equal(connection.listing.id, gift.id);
    assert.equal(connection.runner, undefined);
    assert.equal(connection.tripUntil, undefined);
  }
});

test("a declared trip is associated only with its exact visible vendor", () => {
  const [connection] = preview(
    [gift, { ...gift, id: "outside", vendorId: "outside-scope" }],
    [{ ...runner, destinationVendorId: "outside-scope" }],
  );
  assert.equal(connection.listing.id, gift.id);
  assert.equal(connection.runner, undefined);
  assert.equal(preview([gift], [runner], []).length, 0);
  assert.equal(
    preview([gift], [{ ...runner, destinationVendorId: undefined }])[0].runner,
    undefined,
  );
});

test("unavailable stock, inquiry-only items and invalid prices cannot be reviewed as sale finds", () => {
  const invalid: Listing[] = [
    { ...gift, active: false },
    { ...gift, mode: "MAKE" },
    { ...gift, mode: "DO" },
    { ...gift, inventory: 0 },
    { ...gift, inventory: -1 },
    { ...gift, inventory: 0.5 },
    { ...gift, inventory: Infinity },
    { ...gift, price: -1 },
    { ...gift, price: 28.5 },
    { ...gift, price: NaN },
    { ...gift, price: Infinity },
    { ...gift, price: Number.MAX_SAFE_INTEGER + 1 },
  ];
  for (const listing of invalid) assert.deepEqual(preview([listing]), []);
  assert.equal(preview([{ ...gift, price: 0 }])[0].listing.price, 0);
  assert.equal(preview([{ ...gift, price: 3000 }]).length, 1);
  assert.equal(preview([{ ...gift, price: 3001 }]).length, 0);
});

test("food and locally made intents use listing facts rather than shop category or invented items", () => {
  const food = { ...gift, id: "food", category: "Food", local: false };
  const local = { ...gift, id: "local", category: "Makers", price: 3800 };
  const listings = [gift, food, local];
  const catalog = { listings, vendors: [vendor], runners: [], now };
  assert.deepEqual(
    neighborhoodConnections({ ...catalog, intent: "food" }).map(
      ({ listing }) => listing.id,
    ),
    ["food"],
  );
  assert.deepEqual(
    neighborhoodConnections({ ...catalog, intent: "local" }).map(
      ({ listing }) => listing.id,
    ),
    ["local", "mug"],
  );
  assert.deepEqual(
    neighborhoodConnections({ ...catalog, listings: [food], intent: "gift" }),
    [],
  );
});

test("current declared trips take priority while ties remain deterministic without mutating inputs", () => {
  const otherVendor = { ...vendor, id: "other-shop" };
  const plain = {
    ...gift,
    id: "other-item",
    vendorId: otherVendor.id,
    price: 3000,
  };
  const tied = { ...gift, id: "a-mug" };
  const tripA = { ...runner, id: "a-neighbor" };
  const tripZ = { ...runner, id: "z-neighbor" };
  const listings = [plain, gift, tied];
  const runners = [tripZ, tripA];
  const original = structuredClone({ listings, runners });
  const connections = preview(listings, runners, [vendor, otherVendor]);
  assert.deepEqual(
    connections.map(({ listing }) => listing.id),
    ["a-mug", "mug", "other-item"],
  );
  assert.equal(connections[0].runner?.id, "a-neighbor");
  assert.deepEqual({ listings, runners }, original);
  assert.deepEqual(
    preview([...listings].reverse(), [...runners].reverse(), [
      otherVendor,
      vendor,
    ]),
    connections,
  );
});

test("the candidate window ends at the earlier of trip expiry and availability", () => {
  const shortTrip = { ...runner, tripExpiresAt: now + 1000 };
  assert.equal(preview([gift], [shortTrip])[0].tripUntil, now + 1000);
  assert.equal(preview()[0].tripUntil, runner.availableUntil);
  const expired = neighborhoodConnections({
    listings: [gift],
    vendors: [vendor],
    runners: [shortTrip],
    intent: "gift",
    now: now + 1000,
  });
  assert.equal(expired[0].runner, undefined);
  assert.equal(expired[0].tripUntil, undefined);
  const laterWindow = { ...runner, id: "later", availableUntil: now + 90000 };
  assert.equal(
    preview([gift], [shortTrip, laterWindow])[0].runner?.id,
    "later",
  );
});

test("changed catalog price and stock are reflected without stale cached suggestions", () => {
  assert.equal(preview()[0].listing.price, 2800);
  assert.equal(preview([{ ...gift, price: 2900 }])[0].listing.price, 2900);
  assert.deepEqual(preview([{ ...gift, price: 3100 }]), []);
  assert.deepEqual(preview([{ ...gift, inventory: 0 }]), []);
  assert.deepEqual(preview([]), []);
  for (const invalidNow of [NaN, Infinity, -Infinity])
    assert.deepEqual(
      neighborhoodConnections({
        listings: [gift],
        vendors: [vendor],
        runners: [runner],
        intent: "gift",
        now: invalidNow,
      }),
      [],
    );
});
