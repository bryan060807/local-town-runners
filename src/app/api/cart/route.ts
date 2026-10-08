import { z } from "zod";
import { authenticated } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
export async function GET() {
  try {
    const { client, user } = await authenticated();
    const { data, error } = await client
      .from("cart_items")
      .select(
        "listing_id,quantity,listings(id,title,price_cents,inventory,vendor_id,mode),customer_id",
      )
      .eq("customer_id", user.id);
    if (error) throw error;
    return Response.json({ items: data });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(
      req,
      z
        .object({
          listingId: z.uuid(),
          quantity: z.number().int().min(1).max(20),
        })
        .strict(),
    );
    const { client, user } = await authenticated();
    await limited(client, "cart");
    const { error } = await client
      .from("cart_items")
      .upsert({
        customer_id: user.id,
        listing_id: p.listingId,
        quantity: p.quantity,
      });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, z.object({ listingId: z.uuid() }).strict());
    const { client, user } = await authenticated();
    const { error } = await client
      .from("cart_items")
      .delete()
      .eq("customer_id", user.id)
      .eq("listing_id", p.listingId);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(
      req,
      z
        .object({
          vendorId: z.uuid(),
          requestId: z.uuid(),
          deliveryAddress: z.string().min(8).max(500),
        })
        .strict(),
    );
    const { client } = await authenticated();
    await limited(client, "prepare_cart");
    const { data, error } = await client.rpc("prepare_cart", {
      vendor_id: p.vendorId,
      request_key: p.requestId,
      delivery_address: p.deliveryAddress,
    });
    if (error) throw error;
    return Response.json({ order: data });
  } catch (e) {
    return failure(e);
  }
}
