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
    const { client, user, session } = await demoOrderActor("customer");
    await limited(client, "demo_simulation");
    const { data, error } = await serviceDb().rpc("simulate_demo_payment", {
      order_id: orderId,
      session_hash: session.token_hash,
      customer_id: user.id,
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
        message: "Demo payment simulated. No PayPal charge was made.",
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
