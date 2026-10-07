import { z } from "zod";
import { authenticated } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, z.object({ userId: z.uuid() }).strict());
    const { client, user } = await authenticated();
    await limited(client, "block");
    const { error } = await client
      .from("blocks")
      .insert({ user_id: user.id, blocked_user_id: p.userId });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
