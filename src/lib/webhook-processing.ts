import { paymentMatchesOrder, validCapture } from "./payment-validation";
import { logEvent } from "./observability";
type Order = { id: string; total_cents: number };
type Canonical = {
  id: string;
  purchase_units?: {
    custom_id?: string;
    payments?: {
      captures?: {
        id: string;
        status: string;
        amount: { currency_code: string; value: string };
      }[];
    };
  }[];
};
export async function processWebhook(
  event: unknown,
  services: {
    verify: (event: unknown) => Promise<boolean>;
    findOrder: (paypalId: string) => Promise<Order | null>;
    canonical: (paypalId: string) => Promise<Canonical>;
    confirm: (
      order: Order,
      captureId: string,
      eventId: string,
    ) => Promise<void>;
  },
) {
  if (!(await services.verify(event))) {
    logEvent("webhook_rejected", { stage: "signature", status: 401 });
    return { status: 401, body: "Invalid signature" };
  }
  const e = event as {
    id?: unknown;
    event_type?: unknown;
    resource?: {
      id?: unknown;
      supplementary_data?: { related_ids?: { order_id?: unknown } };
    };
  };
  if (e.event_type !== "PAYMENT.CAPTURE.COMPLETED")
    return { status: 200, body: "Ignored event" };
  const paypalId = e.resource?.supplementary_data?.related_ids?.order_id;
  if (
    typeof paypalId !== "string" ||
    paypalId.length > 100 ||
    typeof e.id !== "string" ||
    e.id.length > 200 ||
    typeof e.resource?.id !== "string"
  )
    return { status: 400, body: "Invalid event" };
  const order = await services.findOrder(paypalId);
  if (!order) {
    logEvent("webhook_retry", { stage: "missing_order", status: 503 });
    return { status: 503, body: "Order not found; retry later" };
  }
  const canonical = await services.canonical(paypalId);
  const capture = canonical.purchase_units?.[0]?.payments?.captures?.find(
    (c) => c.id === e.resource?.id,
  );
  if (
    !paymentMatchesOrder(canonical, order.id, paypalId) ||
    !validCapture(capture, order.total_cents)
  ) {
    logEvent("webhook_rejected", { stage: "payment_mismatch", status: 409 });
    return { status: 409, body: "Payment mismatch" };
  }
  await services.confirm(order, capture!.id, e.id);
  logEvent("webhook_processed", { outcome: "confirmed" });
  return { status: 200, body: "Payment confirmed" };
}
