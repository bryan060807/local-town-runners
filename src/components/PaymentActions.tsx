"use client";
import { useEffect, useState, useCallback } from "react";
import { PaymentAssessment } from "@/lib/payment-validation";
import { paymentMessage } from "@/lib/payment-recovery";
export default function PaymentActions({
  orderId,
  pending,
}: {
  orderId: string;
  pending: boolean;
}) {
  const [payment, setPayment] = useState<PaymentAssessment | null>(null);
  const [status, setStatus] = useState(
    pending ? "Checking existing payment status…" : "",
  );
  const [busy, setBusy] = useState(false);
  const request = useCallback(
    async (endpoint: string) => {
      setBusy(true);
      setStatus(
        endpoint === "capture"
          ? "Capturing payment… Please do not pay again."
          : "Checking existing payment status…",
      );
      try {
        const r = await fetch(`/api/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Payment status unavailable");
        if (data.approvalUrl) {
          window.location.assign(data.approvalUrl);
          return;
        }
        if (data.payment) {
          setPayment(data.payment);
          setStatus(paymentMessage(data.payment));
          if (data.payment.phase === "confirmed") window.location.reload();
        }
      } catch (e) {
        setPayment({ phase: "review" });
        setStatus(
          `${e instanceof Error ? e.message : "Payment status unavailable"}. Please do not pay again. Retry the existing payment status.`,
        );
      } finally {
        setBusy(false);
      }
    },
    [orderId],
  );
  useEffect(() => {
    if (!pending) return;
    const controller = new AbortController();
    fetch("/api/payments/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Payment status unavailable");
        if (controller.signal.aborted) return;
        setPayment(data.payment);
        setStatus(paymentMessage(data.payment));
        if (data.payment.phase === "confirmed") window.location.reload();
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setPayment({ phase: "review" });
        setStatus(
          `${error instanceof Error ? error.message : "Payment status unavailable"}. Please do not pay again. Check the existing payment status.`,
        );
      });
    return () => controller.abort();
  }, [pending, orderId]);
  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {!pending && !payment && (
          <button disabled={busy} onClick={() => request("checkout")}>
            Pay with PayPal Sandbox
          </button>
        )}
        {payment?.phase === "awaiting_approval" && (
          <button disabled={busy} onClick={() => request("checkout")}>
            Continue PayPal approval
          </button>
        )}
        {payment?.phase === "approved" && (
          <button disabled={busy} onClick={() => request("capture")}>
            Confirm approved payment
          </button>
        )}
        {(pending || payment) && (
          <button disabled={busy} onClick={() => request("payments/status")}>
            Check existing payment status
          </button>
        )}
      </div>
      <p role="status">{status}</p>
    </div>
  );
}
