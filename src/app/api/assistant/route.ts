import { z } from "zod";
import { discover } from "@/lib/assistant";
import { conversationTool } from "@/lib/conversation";
import { logEvent } from "@/lib/observability";
import { publicCatalog } from "@/lib/server/catalog";
import { interpret } from "@/lib/server/ai";
import { body, failure, sameOrigin, limited } from "@/lib/server/http";
import { authenticated, HttpError } from "@/lib/server/db";
import { demoRunners } from "@/lib/runners";
import { executeTool } from "@/lib/ai-tools";
const schema = z
  .object({
    message: z.string().min(1).max(1000),
    previousListing: z.string().max(80).optional(),
    resultIds: z.array(z.string().min(1).max(80)).max(4).optional(),
  })
  .strict();
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, schema);
    const catalog = await publicCatalog();
    let runners = demoRunners();
    let orders: Record<string, string> = {};
    if (!catalog.demo) {
      let actor;
      try {
        actor = await authenticated();
      } catch (e) {
        if (!(e instanceof HttpError) || e.status !== 401) throw e;
        const call = conversationTool(
          p.message,
          { selectedListingId: p.previousListing, resultIds: p.resultIds },
          catalog.listings,
        );
        if (call?.name === "prepareOrder")
          throw new HttpError("Sign in to prepare an order", 401);
        if (
          call?.name === "findCompatibleRunners" ||
          call?.name === "estimateFulfillment"
        )
          throw new HttpError("Sign in to check current runner matching", 401);
        const publicRunners = catalog.runners.map((r) => ({
          id: r.id,
          name: r.name,
          area: r.area,
          until: r.availableUntil,
          categories: [],
          maxDetour: 0,
          workload: 3,
          reliability: 0,
        }));
        return Response.json(
          call
            ? executeTool(call.name, call.args, {
                ...catalog,
                runners: publicRunners,
                authenticated: false,
              })
            : discover(p.message, p.previousListing, catalog, publicRunners),
        );
      }
      const { client, user } = actor;
      const { data: ownOrders, error: ordersError } = await client
        .from("orders")
        .select("id,state")
        .eq("customer_id", user.id)
        .limit(50);
      if (ordersError) throw ordersError;
      orders = Object.fromEntries(
        (ownOrders || []).map((o) => [o.id, o.state]),
      );
      await limited(client, "assistant");
      const { data: blocked, error: blockError } =
        await client.rpc("blocked_vendors");
      if (blockError) throw blockError;
      const blockedIds = new Set(
        (blocked || []).map((b: { vendor_id: string }) => b.vendor_id),
      );
      catalog.listings = catalog.listings.filter(
        (l) => !blockedIds.has(l.vendorId),
      );
      catalog.vendors = catalog.vendors.filter((v) => !blockedIds.has(v.id));
      const { data, error } = await client
        .from("runners")
        .select(
          "id,display_name,public_lon,public_lat,available_until,categories,max_detour_miles,reliability",
        )
        .eq("visible", true)
        .gt("available_until", new Date().toISOString());
      if (error) throw error;
      const { data: workloads, error: workloadError } =
        await client.rpc("runner_workloads");
      if (workloadError) throw workloadError;
      const { data: trips, error: tripError } = await client
        .from("runner_trips")
        .select("runner_id,destination_vendor_id,expires_at")
        .order("expires_at", { ascending: false })
        .gt("expires_at", new Date().toISOString());
      if (tripError) throw tripError;
      runners = (data || []).map((r) => ({
        id: r.id,
        name: r.display_name,
        area: [Number(r.public_lon), Number(r.public_lat)],
        until: Date.parse(r.available_until),
        categories: r.categories,
        maxDetour: Number(r.max_detour_miles),
        reliability: Number(r.reliability),
        workload: Number(
          workloads?.find((w: { runner_id: string }) => w.runner_id === r.id)
            ?.workload || 0,
        ),
        destinationVendorId: trips?.find((t) => t.runner_id === r.id)
          ?.destination_vendor_id,
      }));
    }
    const selected = catalog.listings.find(
      (l) => l.id === p.previousListing,
    )?.id;
    const contextCall = conversationTool(
      p.message,
      { selectedListingId: selected, resultIds: p.resultIds },
      catalog.listings,
    );
    const call =
      contextCall ||
      (await interpret(p.message, selected, catalog.listings, p.resultIds));
    if (!call)
      return Response.json(
        discover(p.message, p.previousListing, catalog, runners),
      );
    logEvent("ai_tool_selected", { tool: call.name });
    return Response.json(
      executeTool(call.name, call.args, {
        ...catalog,
        runners,
        authenticated: !catalog.demo,
        orders,
      }),
    );
  } catch (e) {
    logEvent("ai_tool_failure", { outcome: "rejected_or_unavailable" });
    return failure(e);
  }
}
