import { z } from "zod";
import { authenticated } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
import { demoAddress } from "@/lib/demo-catalog";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(
      req,
      z
        .object({
          address: z.string().min(8).max(500),
          notes: z.string().max(500),
        })
        .strict(),
    );
    const { client, user, profile } = await authenticated();
    await limited(client, "preferences");
    const { error } = await client
      .from("customer_preferences")
      .upsert({
        customer_id: user.id,
        delivery_address: profile.demo_workspace ? demoAddress : p.address,
        delivery_notes: p.notes,
      });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
