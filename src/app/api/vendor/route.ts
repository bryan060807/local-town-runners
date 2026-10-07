import { z } from "zod";
import { authenticated } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
const category = z.enum([
  "Food",
  "Gifts",
  "Makers",
  "Farm",
  "Shops",
  "Services",
]);
const input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("update"),
      listingId: z.uuid(),
      inventory: z.number().int().min(0).max(100000),
      priceCents: z.number().int().min(0).max(10000000),
      active: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("createVendor"),
      name: z.string().min(1).max(150),
      slug: z.string().regex(/^[a-z0-9-]{1,150}$/),
      category,
      longitude: z.number().min(-180).max(180),
      latitude: z.number().min(-90).max(90),
    })
    .strict(),
  z
    .object({
      action: z.literal("createListing"),
      vendorId: z.uuid(),
      title: z.string().min(1).max(150),
      description: z.string().max(2000),
      category,
      mode: z.enum(["SELL", "MAKE", "DO"]),
      priceCents: z.number().int().min(0).max(10000000),
      inventory: z.number().int().min(0).max(100000),
      local: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("pickup"),
      vendorId: z.uuid(),
      address: z.string().min(5).max(500),
      longitude: z.number().min(-180).max(180).nullable(),
      latitude: z.number().min(-90).max(90).nullable(),
    })
    .strict(),
]);
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, input);
    const { client } = await authenticated();
    await limited(client, "vendor_edit");
    if (p.action === "update") {
      const { data, error } = await client
        .from("listings")
        .update({
          inventory: p.inventory,
          price_cents: p.priceCents,
          active: p.active,
        })
        .eq("id", p.listingId)
        .select("id");
      if (error || !data?.length) throw Error("Listing not editable");
      return Response.json({ ok: true });
    }
    if (p.action === "createVendor") {
      const { data, error } = await client.rpc("create_vendor", {
        display_name: p.name,
        vendor_slug: p.slug,
        category_name: p.category,
        longitude: p.longitude,
        latitude: p.latitude,
      });
      if (error) throw error;
      return Response.json({ id: data });
    }
    if (p.action === "createListing") {
      const { data, error } = await client.rpc("create_listing", {
        vendor_id: p.vendorId,
        listing_title: p.title,
        listing_description: p.description,
        category_name: p.category,
        listing_mode: p.mode,
        price: p.priceCents,
        stock: p.inventory,
        local_made: p.local,
      });
      if (error) throw error;
      return Response.json({ id: data });
    }
    const { error } = await client.rpc("set_vendor_pickup", {
      vendor_id: p.vendorId,
      address: p.address,
      longitude: p.longitude,
      latitude: p.latitude,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
