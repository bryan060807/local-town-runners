export function validCapture(capture: unknown, total: number) {
  const c = capture as {
    status?: string;
    amount?: { currency_code?: string; value?: string };
  };
  return c?.status === "COMPLETED" && matchesUsd(c.amount, total);
}
export function paymentMatchesOrder(
  payment: unknown,
  orderId: string,
  paypalId: string,
) {
  const p = payment as {
    id?: string;
    purchase_units?: { custom_id?: string }[];
  };
  return (
    p?.id === paypalId &&
    p.purchase_units?.length === 1 &&
    p.purchase_units[0].custom_id === orderId
  );
}
export function validWebhookCertificate(value: string) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      [
        "api.paypal.com",
        "api.sandbox.paypal.com",
        "api-m.paypal.com",
        "api-m.sandbox.paypal.com",
      ].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export type PaymentPhase =
  | "awaiting_approval"
  | "approved"
  | "capture_pending"
  | "captured"
  | "confirmed"
  | "confirmation_pending"
  | "failed"
  | "review";
export type PaymentAssessment = {
  phase: PaymentPhase;
  captureId?: string;
  providerStatus?: string;
  pendingReason?: string;
  category?: string;
};
export type PaymentOrder = { id: string; paypalId: string; totalCents: number };
export class PaymentValidationError extends Error {
  constructor(public category: string) {
    super("Payment verification requires review");
  }
}
/** Decimal strings are exact money, never floating-point approximations. */
function matchesUsd(amount: unknown, total: number) {
  const a = amount as { currency_code?: string; value?: string };
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    a?.currency_code !== "USD" ||
    typeof a.value !== "string" ||
    !/^\d{1,13}(?:\.\d{1,2})?$/.test(a.value)
  )
    return false;
  const [whole, fraction = ""] = a.value.split(".");
  return (
    BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")) === BigInt(total)
  );
}
export function paymentMatchesTotal(payment: unknown, total: number) {
  const p = payment as { purchase_units?: { amount?: unknown }[] };
  return (
    p?.purchase_units?.length === 1 &&
    matchesUsd(p.purchase_units[0].amount, total)
  );
}
const pendingReasons = [
  "ECHECK",
  "PENDING_REVIEW",
  "TRANSACTION_APPROVED_AWAITING_FUNDING",
  "RECEIVING_PREFERENCE_MANDATES_MANUAL_ACTION",
  "UNILATERAL",
  "VERIFICATION_REQUIRED",
  "OTHER",
];
/** Only a canonical GET establishes ownership, expected amount, and capture proof. */
export function inspectOwnedPayment(
  order: PaymentOrder,
  payment: unknown,
): PaymentAssessment {
  if (!paymentMatchesOrder(payment, order.id, order.paypalId))
    throw new PaymentValidationError("order_association");
  if (!paymentMatchesTotal(payment, order.totalCents))
    throw new PaymentValidationError("order_amount_currency");
  const p = payment as {
    status?: string;
    purchase_units: {
      payments?: {
        captures?: {
          id?: string;
          status?: string;
          final_capture?: boolean;
          amount?: unknown;
          status_details?: { reason?: string };
        }[];
      };
    }[];
  };
  const captures = p.purchase_units[0].payments?.captures ?? [];
  if (!Array.isArray(captures) || captures.length > 1)
    throw new PaymentValidationError("capture_count");
  const capture = captures[0];
  if (capture) {
    if (
      typeof capture.id !== "string" ||
      !capture.id ||
      capture.id.length > 100
    )
      throw new PaymentValidationError("capture_id");
    if (
      !matchesUsd(capture.amount, order.totalCents) ||
      capture.final_capture === false
    )
      throw new PaymentValidationError("capture_amount_currency");
    const proof = { captureId: capture.id, providerStatus: capture.status };
    if (capture.status === "COMPLETED" && p.status === "COMPLETED")
      return { ...proof, phase: "captured" };
    if (capture.status === "PENDING")
      return {
        ...proof,
        phase: "capture_pending",
        pendingReason: pendingReasons.includes(
          capture.status_details?.reason ?? "",
        )
          ? capture.status_details!.reason
          : "OTHER",
      };
    if (["DECLINED", "FAILED"].includes(capture.status ?? ""))
      return { ...proof, phase: "failed" };
    return { phase: "review", category: "capture_status" };
  }
  if (p.status === "APPROVED") return { phase: "approved" };
  if (["CREATED", "SAVED", "PAYER_ACTION_REQUIRED"].includes(p.status ?? ""))
    return { phase: "awaiting_approval" };
  if (p.status === "VOIDED") return { phase: "failed" };
  return { phase: "review", category: "missing_capture" };
}
/** Status checks never capture. Explicit capture gets one durable claim, then canonical re-read. */
export async function reconcileOwnedCapture(
  order: PaymentOrder,
  services: {
    read: () => Promise<unknown>;
    capture?: () => Promise<unknown>;
    claimCapture?: () => Promise<boolean>;
  },
): Promise<PaymentAssessment> {
  const assessment = inspectOwnedPayment(order, await services.read());
  if (assessment.phase !== "approved" || !services.capture) return assessment;
  if (!services.claimCapture)
    return { phase: "review", category: "capture_claim_missing" };
  if (!(await services.claimCapture())) {
    // Another request may have just captured and committed while we waited for its row lock.
    const current = inspectOwnedPayment(order, await services.read());
    return ["captured", "capture_pending", "failed"].includes(current.phase)
      ? current
      : { phase: "review", category: "capture_already_attempted" };
  }
  let response: unknown;
  try {
    response = await services.capture();
  } catch {
    /* A timeout/error may follow a successful capture. Never immediately capture again. */
  }
  try {
    const current = inspectOwnedPayment(order, await services.read());
    if (
      response !== undefined &&
      (response as { id?: unknown })?.id !== order.paypalId
    )
      return { phase: "review", category: "capture_response_order" };
    if (current.phase === "approved" || current.phase === "awaiting_approval")
      return { phase: "review", category: "capture_result_uncertain" };
    return current;
  } catch (e) {
    if (e instanceof PaymentValidationError) throw e;
    return { phase: "review", category: "capture_result_unavailable" };
  }
}

export function validRefund(value: unknown, total: number) {
  const r = value as {
    id?: string;
    status?: string;
    amount?: { currency_code?: string; value?: string };
  };
  return (
    typeof r?.id === "string" &&
    r.id.length > 0 &&
    r.id.length <= 100 &&
    r.status === "COMPLETED" &&
    r.amount?.currency_code === "USD" &&
    r.amount.value === (total / 100).toFixed(2)
  );
}
