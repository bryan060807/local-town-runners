"use client";
import { useState } from "react";
export default function AdminPaymentRecovery() {
  const [orderId, setOrderId] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function check(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/admin/payment-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Payment status unavailable");
      setStatus(data.message);
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Payment status unavailable",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="simple-card">
      <h2>Recover an existing payment</h2>
      <p>
        Check an existing order’s PayPal status and reconcile a verified
        completed capture. This also works after a demo session expires. This
        action cannot charge a buyer.
      </p>
      <form onSubmit={check}>
        <label>
          Marketplace order ID
          <input
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            required
            pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
          />
        </label>
        <button disabled={busy || !orderId}>
          {busy
            ? "Checking existing payment…"
            : "Check and reconcile existing payment"}
        </button>
      </form>
      {status && <p role="status">{status}</p>}
    </section>
  );
}
