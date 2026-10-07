import { z } from "zod";
import { authenticated } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(
      req,
      z
        .object({
          orderId: z.uuid(),
          rating: z.number().int().min(1).max(5),
          comment: z.string().max(1000),
        })
        .strict(),
    );
    const { client, user } = await authenticated();
    await limited(client, "review");
    const { error } = await client.from("reviews").insert({
      order_id: p.orderId,
      customer_id: user.id,
      rating: p.rating,
      comment: p.comment,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
