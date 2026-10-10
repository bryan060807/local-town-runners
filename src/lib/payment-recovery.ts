import { PaymentAssessment } from "./payment-validation";
/** Provider proof survives a local database failure; no financial operation occurs here. */
export async function confirmVerifiedPayment(
  assessment: PaymentAssessment,
  confirm: (captureId: string) => Promise<void>,
): Promise<PaymentAssessment> {
  if (assessment.phase !== "captured" || !assessment.captureId)
    return assessment;
  try {
    await confirm(assessment.captureId);
    return { ...assessment, phase: "confirmed" };
  } catch {
    return {
      ...assessment,
      phase: "confirmation_pending",
      category: "database_reconciliation",
    };
  }
}
export function paymentMessage(payment: PaymentAssessment) {
  switch (payment.phase) {
    case "awaiting_approval":
      return "Awaiting PayPal approval. No completed payment has been verified.";
    case "approved":
      return "PayPal approved your payment. Confirm it once to capture the payment.";
    case "capture_pending":
      return payment.pendingReason === "ECHECK"
        ? "PayPal is processing your eCheck. Your payment has not completed yet. Please do not pay again."
        : "PayPal is processing your payment. It has not completed yet. Please do not pay again.";
    case "captured":
    case "confirmation_pending":
      return "Payment received — confirming your order. Please do not pay again.";
    case "confirmed":
      return "Payment confirmed. Your order is paid.";
    case "failed":
      return "PayPal reports that the payment did not complete. Contact support before trying another payment.";
    case "review":
      return "Payment status requires review. Please do not pay again. Check the existing payment status or contact support.";
  }
}
