import { readLimited } from "@/lib/request-body";
import { prepareSchema } from "@/lib/orders";
import { listings, money } from "@/lib/catalog";
export async function POST(req: Request) {
  try {
    const p = prepareSchema.safeParse(JSON.parse(await readLimited(req)));
    if (!p.success)
      return Response.json({ error: "Invalid order" }, { status: 400 });
    const l = listings.find((l) => l.id === p.data.listingId && l.active);
    if (!l || l.inventory < p.data.quantity)
      return Response.json({ error: "Not available" }, { status: 409 });
    return Response.json({
      preview: true,
      listing: l,
      quantity: p.data.quantity,
      total: l.price * p.data.quantity,
      formatted: money(l.price * p.data.quantity),
      message:
        "Preview only. Sign in and configure Supabase and PayPal to persist and pay for an order.",
    });
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
