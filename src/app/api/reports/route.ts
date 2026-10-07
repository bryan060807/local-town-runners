import { z } from "zod";
import { authenticated } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(
      req,
      z
        .object({ listingId: z.uuid(), reason: z.string().min(5).max(1000) })
        .strict(),
    );
    const { client, user } = await authenticated();
    await limited(client, "report");
    const { error } = await client.from("reports").insert({
      reporter_id: user.id,
      listing_id: p.listingId,
      reason: p.reason,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
