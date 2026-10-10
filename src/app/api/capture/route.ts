import { DatabaseOperationError } from "@/lib/server/errors";
import { reconcileOwnedCapture } from "@/lib/payment-validation";
import { z } from "zod";
import { authenticated, serviceDb, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
import { paypal } from "@/lib/server/paypal";
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
    let captureId: string;
    try {
      captureId = await reconcileOwnedCapture(
        { id: o.id, paypalId: o.paypal_order_id, totalCents: o.total_cents },
        {
          read: () =>
            paypal(
              `/v2/checkout/orders/${encodeURIComponent(o.paypal_order_id)}`,
            ),
          capture: () =>
            paypal(
              `/v2/checkout/orders/${encodeURIComponent(o.paypal_order_id)}/capture`,
              {},
              `capture-${o.id}`,
            ),
        },
      );
    } catch (e) {
      if (
        e instanceof Error &&
        ["Payment order mismatch", "Payment not confirmed"].includes(e.message)
      )
        throw new HttpError(e.message, 409);
      throw e;
    }
    const { error } = await service.rpc("confirm_payment", {
      order_id: o.id,
      capture_id: captureId,
      event_id: `capture-${captureId}`,
      amount_cents: o.total_cents,
    });
    if (error) throw new DatabaseOperationError(error, "confirm_payment");
    return Response.json({ state: "PAID" });
  } catch (e) {
    return failure(e);
  }
}
