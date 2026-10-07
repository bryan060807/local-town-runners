import { z } from "zod";
import { authenticated, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(
      req,
      z
        .object({
          resourceType: z.enum(["profile", "listing", "vendor"]),
          resourceId: z.uuid(),
          disabled: z.boolean(),
        })
        .strict(),
    );
    const { client } = await authenticated();
    await limited(client, "moderation");
    const { error } = await client.rpc("moderate", {
      resource_type: p.resourceType,
      resource_id: p.resourceId,
      disabled: p.disabled,
    });
    if (error) throw new HttpError("Admin operation denied", 403);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
