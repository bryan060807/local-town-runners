import { z } from "zod";
import { demoOrderActor } from "@/lib/server/demo-orders";
import { serviceDb, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { orderId } = await body(
      req,
      z.object({ orderId: z.uuid() }).strict(),
    );
    const { client, user, session } = await demoOrderActor("vendor");
    await limited(client, "demo_simulation_cancel");
    const { data, error } = await serviceDb().rpc("cancel_demo_order", {
      order_id: orderId,
      session_hash: session.token_hash,
      actor_id: user.id,
    });
    if (error) {
      if (error.code === "PGRST202")
        throw new HttpError(
          "Demo order simulation setup is not active yet",
          503,
        );
      throw error;
    }
    return Response.json(
      {
        order: data,
        simulated: true,
        message: "Simulated order canceled. No PayPal refund applies.",
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
