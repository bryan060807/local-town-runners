import { logEvent } from "@/lib/observability";
import { z } from "zod";
import { authenticated, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept"), orderId: z.uuid() }).strict(),
  z
    .object({
      action: z.literal("availability"),
      minutes: z.number().int().min(0).max(720),
      categories: z
        .array(z.enum(["Food", "Gifts", "Farm", "Makers", "Shops", "Services"]))
        .min(1)
        .max(6),
      maxDetour: z.number().min(0).max(50),
    })
    .strict(),
  z
    .object({
      action: z.literal("trip"),
      vendorId: z.uuid(),
      minutes: z.number().int().min(1).max(720),
      note: z.string().max(200),
    })
    .strict(),
]);
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, schema);
    const { client, user } = await authenticated();
    await limited(client, "runner");
    if (p.action === "accept") {
      const { data, error } = await client.rpc("accept_run", {
        order_id: p.orderId,
      });
      if (error) throw error;
      logEvent("runner_assignment", { outcome: "accepted" });
      return Response.json({ order: data });
    }
    if (p.action === "trip") {
      const { error } = await client.from("runner_trips").insert({
        runner_id: user.id,
        destination_vendor_id: p.vendorId,
        expires_at: new Date(Date.now() + p.minutes * 60000).toISOString(),
        note: p.note,
      });
      if (error) throw error;
    } else {
      const { data, error } = await client
        .from("runners")
        .update({
          available_until: new Date(
            Date.now() + p.minutes * 60000,
          ).toISOString(),
          categories: p.categories,
          max_detour_miles: p.maxDetour,
          visible: p.minutes > 0,
        })
        .eq("id", user.id)
        .select("id");
      if (error || !data?.length)
        throw new HttpError("Runner permissions required", 403);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
