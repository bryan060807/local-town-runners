import { z } from "zod";
import { adminUser } from "@/lib/server/onboarding";
import { serviceDb, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
import { recoverPayment } from "@/lib/server/payment-recovery";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, z.object({ orderId: z.uuid() }).strict());
    const { client } = await adminUser();
    await limited(client, "payment_recovery_admin");
    const { data: o, error } = await serviceDb()
      .from("orders")
      .select("id,state,paypal_order_id,paypal_capture_id,total_cents")
      .eq("id", p.orderId)
      .single();
    if (error || !o || !o.paypal_order_id)
      throw new HttpError("Order unavailable", 404);
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
    // Administration can reconcile an expired session's capture, never initiate one.
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
