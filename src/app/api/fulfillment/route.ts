import { logEvent } from "@/lib/observability";
import { z } from "zod";
import { authenticated } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
import { states } from "@/lib/orders";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(
      req,
      z.object({ orderId: z.uuid(), state: z.enum(states) }).strict(),
    );
    const { client } = await authenticated();
    await limited(client, "fulfillment");
    const { data, error } = await client.rpc("transition_order", {
      order_id: p.orderId,
      target_state: p.state,
    });
    if (error) throw error;
    logEvent("order_transition", { stage: p.state, outcome: "applied" });
    return Response.json({ order: data });
  } catch (e) {
    return failure(e);
  }
}
