import { z } from "zod";
import { authenticated, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
import { recoverPayment } from "@/lib/server/payment-recovery";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, z.object({ orderId: z.uuid() }).strict());
    const { client, user } = await authenticated();
    await limited(client, "payment_status");
    const { data: o } = await client
      .from("orders")
      .select("id,state,paypal_order_id,paypal_capture_id,total_cents")
      .eq("id", p.orderId)
      .eq("customer_id", user.id)
      .single();
    if (!o || !o.paypal_order_id) throw new HttpError("Order unavailable", 404);
    if (o.paypal_capture_id)
      return Response.json(
        {
          state: o.state,
          payment: { phase: "confirmed" },
          message: "Payment confirmed. Your order is paid.",
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    if (o.state !== "PENDING_PAYMENT")
      throw new HttpError("Order is not awaiting payment", 409);
    const result = await recoverPayment({
      id: o.id,
      paypalId: o.paypal_order_id,
      totalCents: Number(o.total_cents),
    });
    return Response.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
