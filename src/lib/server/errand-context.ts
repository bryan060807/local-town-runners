import "server-only";
import type { ToolContext } from "@/lib/ai-tools";
import { demoRunners, type Runner } from "@/lib/runners";
import { publicCatalog } from "./catalog";
import { authenticated } from "./db";
import { limited } from "./http";

export type ErrandContext = {
  context: Omit<ToolContext, "runners"> & {
    runners: Array<Runner & { tripExpiresAt?: number }>;
  };
  offline: boolean;
};

export async function loadErrandContext(
  consumeRateLimit = true,
): Promise<ErrandContext> {
  const catalog = await publicCatalog();
  if (catalog.demo) {
    return {
      offline: true,
      context: {
        ...catalog,
        authenticated: false,
        runners: demoRunners().map((runner) => ({
          ...runner,
          ...(runner.destinationVendorId
            ? { tripExpiresAt: runner.until }
            : {}),
        })),
      },
    };
  }

  const { client } = await authenticated();
  if (consumeRateLimit) await limited(client, "assistant");
  const { data: blocked, error: blockError } =
    await client.rpc("blocked_vendors");
  if (blockError) throw blockError;
  const blockedIds = new Set(
    (blocked || []).map((row: { vendor_id: string }) => row.vendor_id),
  );
  const listings = catalog.listings.filter(
    (listing) => !blockedIds.has(listing.vendorId),
  );
  const vendors = catalog.vendors.filter(
    (vendor) => !blockedIds.has(vendor.id),
  );
  // Keep the catalog's caller-visible workspace boundary for every fresh read.
  const runnerIds = catalog.runners.map((runner) => runner.id);
  const vendorIds = vendors.map((vendor) => vendor.id);
  const { data, error } = runnerIds.length
    ? await client
        .from("runners")
        .select(
          "id,display_name,public_lon,public_lat,available_until,categories,max_detour_miles,reliability",
        )
        .in("id", runnerIds)
        .eq("visible", true)
        .gt("available_until", new Date().toISOString())
    : { data: [], error: null };
  if (error) throw error;
  const { data: workloads, error: workloadError } =
    await client.rpc("runner_workloads");
  if (workloadError) throw workloadError;
  const { data: trips, error: tripError } =
    runnerIds.length && vendorIds.length
      ? await client
          .from("runner_trips")
          .select("runner_id,destination_vendor_id,expires_at")
          .in("runner_id", runnerIds)
          .in("destination_vendor_id", vendorIds)
          .order("expires_at", { ascending: false })
          .gt("expires_at", new Date().toISOString())
      : { data: [], error: null };
  if (tripError) throw tripError;

  const runners: ErrandContext["context"]["runners"] = (data || []).map(
    (runner) => {
      const trip = trips?.find((row) => row.runner_id === runner.id);
      return {
        id: runner.id,
        name: runner.display_name,
        area: [Number(runner.public_lon), Number(runner.public_lat)],
        until: Date.parse(runner.available_until),
        categories: runner.categories,
        maxDetour: Number(runner.max_detour_miles),
        reliability: Number(runner.reliability),
        workload: Number(
          workloads?.find(
            (row: { runner_id: string }) => row.runner_id === runner.id,
          )?.workload || 0,
        ),
        ...(trip
          ? {
              destinationVendorId: trip.destination_vendor_id,
              tripExpiresAt: Date.parse(trip.expires_at),
            }
          : {}),
      };
    },
  );
  return {
    offline: false,
    context: {
      listings,
      vendors,
      runners,
      authenticated: true,
    },
  };
}
