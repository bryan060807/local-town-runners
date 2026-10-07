import { z } from "zod";
import { authenticated } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
const input = z
  .object({
    listingId: z.uuid(),
    quantity: z.number().int().min(1).max(20),
    requestId: z.uuid(),
    deliveryAddress: z.string().min(8).max(500),
  })
  .strict();
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, input);
    const { client } = await authenticated();
    await limited(client, "prepare_order");
    const { data, error } = await client.rpc("prepare_order", {
      listing_id: p.listingId,
      qty: p.quantity,
      request_key: p.requestId,
      delivery_address: p.deliveryAddress,
    });
    if (error) throw error;
    return Response.json({ order: data });
  } catch (e) {
    return failure(e);
  }
}
export async function GET() {
  try {
    const { client } = await authenticated();
    const { data, error } = await client
      .from("orders")
      .select(
        "id,state,total_cents,quantity,created_at,listing_id,payout_status",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return Response.json({ orders: data });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, z.object({ orderId: z.uuid() }).strict());
    const { client } = await authenticated();
    await limited(client, "cancel_order");
    const { error } = await client.rpc("cancel_draft", { order_id: p.orderId });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
