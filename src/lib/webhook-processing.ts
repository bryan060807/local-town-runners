import {
  inspectOwnedPayment,
  PaymentValidationError,
} from "./payment-validation";
import { logEvent } from "./observability";
type Order = { id: string; total_cents: number };
type Canonical = {
  id: string;
  status?: string;
  purchase_units?: {
    custom_id?: string;
    amount?: { currency_code: string; value: string };
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
  if (
    !["PAYMENT.CAPTURE.COMPLETED", "PAYMENT.CAPTURE.PENDING"].includes(
      String(e.event_type),
    )
  )
    return { status: 200, body: "Ignored event" };
  const paypalId = e.resource?.supplementary_data?.related_ids?.order_id;
  if (
    typeof paypalId !== "string" ||
    !paypalId ||
    paypalId.length > 100 ||
    typeof e.id !== "string" ||
    !e.id ||
    e.id.length > 200 ||
    typeof e.resource?.id !== "string" ||
    !e.resource.id ||
    e.resource.id.length > 100
  )
    return { status: 400, body: "Invalid event" };
  const order = await services.findOrder(paypalId);
  if (!order) {
    logEvent("webhook_retry", { stage: "missing_order", status: 503 });
    return { status: 503, body: "Order not found; retry later" };
  }
  const canonical = await services.canonical(paypalId);
  let assessment;
  try {
    assessment = inspectOwnedPayment(
      { id: order.id, paypalId, totalCents: order.total_cents },
      canonical,
    );
  } catch (error) {
    if (!(error instanceof PaymentValidationError)) throw error;
    logEvent("webhook_rejected", {
      orderId: order.id,
      stage: error.category,
      status: 409,
    });
    return { status: 409, body: "Payment mismatch" };
  }
  if (assessment.captureId !== e.resource.id) {
    logEvent("webhook_rejected", {
      orderId: order.id,
      stage: "capture_id",
      status: 409,
    });
    return { status: 409, body: "Payment mismatch" };
  }
  if (assessment.phase !== "captured") {
    logEvent("webhook_pending", {
      orderId: order.id,
      stage: assessment.phase,
      capturePresent: true,
    });
    return e.event_type === "PAYMENT.CAPTURE.PENDING"
      ? { status: 200, body: "Payment pending" }
      : { status: 503, body: "Capture not completed; retry later" };
  }
  await services.confirm(order, assessment.captureId, e.id);
  logEvent("webhook_processed", { outcome: "confirmed" });
  return { status: 200, body: "Payment confirmed" };
}
