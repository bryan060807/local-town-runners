import type { Listing, Vendor } from "./catalog";
import type { PublicRunner } from "./map-types";

export type ConnectionIntent = "gift" | "food" | "local";

export type NeighborhoodConnection = {
  listing: Listing;
  vendor: Vendor;
  runner?: PublicRunner;
  /** End of the current availability/trip window, never an arrival estimate. */
  tripUntil?: number;
};

type ConnectionCatalog = {
  listings: Listing[];
  vendors: Vendor[];
  runners: PublicRunner[];
  intent: ConnectionIntent;
  now: number;
};

/**
 * A discovery preview from the caller's visible catalog. A declared trip is
 * only a candidate: category, workload, approach and acceptance are checked
 * by the existing matching and fulfillment paths, not inferred here.
 */
export function neighborhoodConnections({
  listings,
  vendors,
  runners,
  intent,
  now,
}: ConnectionCatalog): NeighborhoodConnection[] {
  if (!Number.isFinite(now)) return [];
  const vendorById = new Map(vendors.map((vendor) => [vendor.id, vendor]));
  const currentTrips = new Map<string, PublicRunner>();
  const windowEnd = (runner: PublicRunner) =>
    Math.min(runner.availableUntil, runner.tripExpiresAt!);

  for (const runner of runners) {
    const destination = runner.destinationVendorId;
    if (
      !destination ||
      !vendorById.has(destination) ||
      !Number.isFinite(runner.availableUntil) ||
      runner.availableUntil <= now ||
      !Number.isFinite(runner.tripExpiresAt) ||
      runner.tripExpiresAt! <= now
    )
      continue;
    const existing = currentTrips.get(destination);
    if (
      !existing ||
      windowEnd(runner) > windowEnd(existing) ||
      (windowEnd(runner) === windowEnd(existing) &&
        runner.id.localeCompare(existing.id) < 0)
    )
      currentTrips.set(destination, runner);
  }

  const connections: NeighborhoodConnection[] = [];
  for (const listing of listings) {
    const vendor = vendorById.get(listing.vendorId);
    if (
      !vendor ||
      !listing.active ||
      listing.mode !== "SELL" ||
      !Number.isSafeInteger(listing.inventory) ||
      listing.inventory <= 0 ||
      !Number.isSafeInteger(listing.price) ||
      listing.price < 0
    )
      continue;
    if (
      (intent === "gift" &&
        (listing.category !== "Gifts" || listing.price > 3000)) ||
      (intent === "food" && listing.category !== "Food") ||
      (intent === "local" && !listing.local)
    )
      continue;
    const runner = currentTrips.get(vendor.id);
    connections.push({
      listing,
      vendor,
      ...(runner ? { runner, tripUntil: windowEnd(runner) } : {}),
    });
  }
  return connections.sort(
    (a, b) =>
      Number(Boolean(b.runner)) - Number(Boolean(a.runner)) ||
      Number(b.listing.local) - Number(a.listing.local) ||
      b.listing.price - a.listing.price ||
      a.listing.title.localeCompare(b.listing.title) ||
      a.listing.id.localeCompare(b.listing.id),
  );
}
