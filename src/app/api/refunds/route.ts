import { z } from "zod";
import { authenticated, serviceDb, HttpError } from "@/lib/server/db";
import { body, failure, sameOrigin, limited } from "@/lib/server/http";
import { paypal } from "@/lib/server/paypal";
import { validRefund } from "@/lib/payment-validation";
import { logEvent } from "@/lib/observability";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, z.object({ orderId: z.uuid() }).strict());
    const { client, user } = await authenticated();
    await limited(client, "refund");
    const { data: order, error } = await client
      .from("orders")
      .select("id,vendor_id")
      .eq("id", p.orderId)
      .single();
    if (error || !order) throw new HttpError("Order unavailable", 404);
    const { data: vendor } = await client
      .from("vendors")
      .select("owner_id")
      .eq("id", order.vendor_id)
      .single();
    const { data: admin } = await client.rpc("has_role", { wanted: "admin" });
    if (vendor?.owner_id !== user.id && !admin)
      throw new HttpError("Vendor owner or administrator required", 403);
    const service = serviceDb();
    const { data: o, error: start } = await service.rpc("begin_refund", {
      order_id: p.orderId,
    });
    if (start) throw start;
    if (o.refund_state === "COMPLETED")
      return Response.json({ state: "COMPLETED" });
    const refund = await paypal(
      `/v2/payments/captures/${encodeURIComponent(o.paypal_capture_id)}/refund`,
      {
        amount: {
          currency_code: "USD",
          value: (Number(o.total_cents) / 100).toFixed(2),
        },
        note_to_payer: "Demo vendor declined fulfillment. Sandbox refund.",
      },
      `refund-${o.id}`,
    );
    if (!validRefund(refund, Number(o.total_cents)))
      throw new HttpError(
        "Refund is pending or not confirmed. Retry reconciliation; no refund success is assumed.",
        409,
      );
    const { error: save } = await service.rpc("confirm_refund", {
      order_id: o.id,
      refund_id: refund.id,
      amount_cents: o.total_cents,
    });
    if (save) throw save;
    logEvent("refund_confirmed", { outcome: "sandbox_completed" });
    return Response.json({ state: "COMPLETED" });
  } catch (e) {
    return failure(e);
  }
}
