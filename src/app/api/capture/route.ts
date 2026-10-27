import { z } from "zod";
import { authenticated, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
import { recoverPayment } from "@/lib/server/payment-recovery";
import { rejectSimulatedPayment } from "@/lib/server/demo-orders";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, z.object({ orderId: z.uuid() }).strict());
    const { client, user } = await authenticated();
    await limited(client, "capture");
    const { data: o } = await client
      .from("orders")
      .select(
        "id,state,customer_id,paypal_order_id,paypal_capture_id,total_cents,demo_simulated",
      )
      .eq("id", p.orderId)
      .eq("customer_id", user.id)
      .single();
    if (o) rejectSimulatedPayment(o);
    if (!o || !o.paypal_order_id) throw new HttpError("Order unavailable", 404);
    if (o.state !== "PENDING_PAYMENT") {
      if (!o.paypal_capture_id) throw new HttpError("Order not payable", 409);
      return Response.json(
        {
          state: o.state,
          payment: { phase: "confirmed" },
          message: "Payment confirmed. Your order is paid.",
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const result = await recoverPayment(
      {
        id: o.id,
        paypalId: o.paypal_order_id,
        totalCents: Number(o.total_cents),
      },
      true,
    );
    return Response.json(result, {
      status: result.payment.phase === "confirmed" ? 200 : 202,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
