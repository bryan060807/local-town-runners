import "server-only";
import { logEvent } from "@/lib/observability";
import { confirmVerifiedPayment, paymentMessage } from "@/lib/payment-recovery";
import {
  PaymentOrder,
  PaymentValidationError,
  reconcileOwnedCapture,
  PaymentAssessment,
} from "@/lib/payment-validation";
import { serviceDb, HttpError } from "./db";
import { DatabaseOperationError } from "./errors";
import { paypal } from "./paypal";
export async function recoverPayment(
  order: PaymentOrder,
  allowCapture = false,
  provider: typeof paypal = paypal,
) {
  const service = serviceDb();
  const ready = await service.rpc("phase42_ready");
  if (ready.error || !ready.data)
    throw new HttpError(
      "Payment recovery setup is required. Please do not pay again.",
      503,
    );
  const read = () =>
    provider(`/v2/checkout/orders/${encodeURIComponent(order.paypalId)}`);
  let result: PaymentAssessment;
  try {
    result = await reconcileOwnedCapture(order, {
      read,
      ...(allowCapture
        ? {
            claimCapture: async () => {
              const r = await service.rpc("claim_payment_capture", {
                order_id: order.id,
                paypal_id: order.paypalId,
              });
              if (r.error)
                throw new DatabaseOperationError(
                  r.error,
                  "claim_payment_capture",
                );
              logEvent("payment_recovery", {
                orderId: order.id,
                stage: "capture_claim",
                outcome: r.data ? "claimed" : "already_attempted",
              });
              return r.data === true;
            },
            capture: () =>
              provider(
                `/v2/checkout/orders/${encodeURIComponent(order.paypalId)}/capture`,
                {},
                `capture-${order.id}`,
              ),
          }
        : {}),
    });
  } catch (e) {
    if (!(e instanceof PaymentValidationError)) throw e;
    result = { phase: "review", category: e.category };
  }
  if (result.phase === "approved") {
    const attempt = await service
      .from("payment_recovery")
      .select("capture_attempted_at")
      .eq("order_id", order.id)
      .maybeSingle();
    if (attempt.error)
      throw new DatabaseOperationError(attempt.error, "claim_payment_capture");
    if (attempt.data?.capture_attempted_at)
      result = { phase: "review", category: "capture_already_attempted" };
  }
  logEvent("payment_recovery", {
    orderId: order.id,
    stage: result.phase,
    outcome: result.category ?? result.providerStatus ?? "verified",
    capturePresent: !!result.captureId,
  });
  result = await confirmVerifiedPayment(result, async (captureId) => {
    const r = await service.rpc("confirm_payment", {
      order_id: order.id,
      capture_id: captureId,
      event_id: `capture-${captureId}`,
      amount_cents: order.totalCents,
    });
    if (r.error) {
      logEvent("database_failure", {
        orderId: order.id,
        operation: "confirm_payment",
        code: /^[A-Z0-9]{4,12}$/.test(r.error.code) ? r.error.code : undefined,
      });
      throw new DatabaseOperationError(r.error, "confirm_payment");
    }
  });
  // Update fields explicitly so observation refreshes never reset the durable capture attempt.
  const seed = await service
    .from("payment_recovery")
    .upsert(
      { order_id: order.id },
      { onConflict: "order_id", ignoreDuplicates: true },
    );
  const observed = await service
    .from("payment_recovery")
    .update({
      phase: result.phase,
      observed_capture_id: result.captureId ?? null,
      provider_status: result.providerStatus ?? null,
      pending_reason: result.pendingReason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", order.id);
  if (seed.error || observed.error)
    logEvent("payment_recovery", {
      orderId: order.id,
      stage: "observation",
      outcome: "persistence_unavailable",
    });
  logEvent("payment_recovery", {
    orderId: order.id,
    stage: "reconciliation",
    outcome: result.phase,
  });
  return {
    payment: result,
    message: paymentMessage(result),
    ...(result.phase === "confirmed" ? { state: "PAID" } : {}),
  };
}
