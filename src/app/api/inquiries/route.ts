import { z } from "zod";
import { authenticated, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(
      req,
      z
        .object({ listingId: z.uuid(), message: z.string().min(5).max(1000) })
        .strict(),
    );
    const { client, user } = await authenticated();
    await limited(client, "inquiry");
    const { error } = await client.from("inquiries").insert({
      listing_id: p.listingId,
      customer_id: user.id,
      message: p.message,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(
      req,
      z
        .object({ id: z.uuid(), response: z.string().min(1).max(2000) })
        .strict(),
    );
    const { client } = await authenticated();
    await limited(client, "inquiry_response");
    const { data, error } = await client
      .from("inquiries")
      .update({ response: p.response, status: "RESPONDED" })
      .eq("id", p.id)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new HttpError("Vendor permission required", 403);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
