import { paymentMatchesOrder } from "@/lib/payment-validation";
import { z } from "zod";
import { authenticated, serviceDb, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
import { paypal, validCapture } from "@/lib/server/paypal";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, z.object({ orderId: z.uuid() }).strict());
    const { client, user } = await authenticated();
    await limited(client, "capture");
    const { data: o } = await client
      .from("orders")
      .select("*")
      .eq("id", p.orderId)
      .eq("customer_id", user.id)
      .single();
    if (!o || !o.paypal_order_id) throw new HttpError("Order unavailable", 404);
    if (o.state !== "PENDING_PAYMENT") return Response.json({ state: o.state });
    const service = serviceDb();
    const { error: serviceError } = await service
      .from("orders")
      .select("id")
      .eq("id", o.id)
      .single();
    if (serviceError)
      throw new HttpError(
        "Payment reconciliation database is unavailable",
        503,
      );
    let result = await paypal(
      `/v2/checkout/orders/${encodeURIComponent(o.paypal_order_id)}`,
    );
    if (result.status !== "COMPLETED")
      result = await paypal(
        `/v2/checkout/orders/${encodeURIComponent(o.paypal_order_id)}/capture`,
        {},
        `capture-${o.id}`,
      );
    const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
    if (
      !paymentMatchesOrder(result, o.id, o.paypal_order_id) ||
      !validCapture(capture, o.total_cents)
    )
      throw new HttpError("Payment not confirmed", 409);
    const { error } = await service.rpc("confirm_payment", {
      order_id: o.id,
      capture_id: capture.id,
      event_id: `capture-${capture.id}`,
      amount_cents: o.total_cents,
    });
    if (error) throw error;
    return Response.json({ state: "PAID" });
  } catch (e) {
    return failure(e);
  }
}
