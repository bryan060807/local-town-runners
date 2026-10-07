import { z } from "zod";
import { authenticated } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
import { brand } from "@/lib/brand";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(
      req,
      z
        .object({
          userId: z.uuid(),
          role: z.enum(["customer", "vendor", "runner", "admin"]),
        })
        .strict(),
    );
    const { client } = await authenticated();
    await limited(client, "role_assignment");
    const { error } = await client.rpc("assign_role", {
      target_user: p.userId,
      wanted: p.role,
      longitude: brand.center[0],
      latitude: brand.center[1],
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
