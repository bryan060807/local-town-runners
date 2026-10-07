import { readLimited } from "@/lib/request-body";
import { paymentMatchesOrder } from "@/lib/payment-validation";
import { serviceDb } from "@/lib/server/db";
import { failure } from "@/lib/server/http";
import { paypal, validCapture, verifyWebhook } from "@/lib/server/paypal";
export async function POST(req: Request) {
  try {
    const text = await readLimited(req, 100000);
    const event = JSON.parse(text);
    if (!(await verifyWebhook(req.headers, event)))
      return new Response("Invalid signature", { status: 401 });
    if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED")
      return Response.json({ ignored: true });
    const paypalId = event.resource?.supplementary_data?.related_ids?.order_id;
    if (typeof paypalId !== "string" || typeof event.id !== "string")
      return new Response("Invalid event", { status: 400 });
    const client = serviceDb();
    const { data: o } = await client
      .from("orders")
      .select("id,total_cents")
      .eq("paypal_order_id", paypalId)
      .single();
    if (!o)
      return new Response("Order not found; retry later", { status: 503 });
    const canonical = await paypal(
      `/v2/checkout/orders/${encodeURIComponent(paypalId)}`,
    );
    const capture = canonical.purchase_units?.[0]?.payments?.captures?.find(
      (c: { id: string }) => c.id === event.resource.id,
    );
    if (
      !paymentMatchesOrder(canonical, o.id, paypalId) ||
      !validCapture(capture, o.total_cents)
    )
      return new Response("Payment mismatch", { status: 409 });
    const { error } = await client.rpc("confirm_payment", {
      order_id: o.id,
      capture_id: capture.id,
      event_id: event.id,
      amount_cents: o.total_cents,
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
