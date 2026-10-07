"use client";
import { useState } from "react";
export default function DashboardActions({
  orderId,
  actions,
}: {
  orderId: string;
  actions: string[];
}) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function action(a: string) {
    setBusy(true);
    try {
      const endpoint =
        a === "Cancel draft"
          ? "orders"
          : a === "Pay with PayPal Sandbox"
            ? "checkout"
            : a === "Confirm approved payment"
              ? "capture"
              : a === "Accept run"
                ? "runner"
                : "fulfillment";
      const r = await fetch(`/api/${endpoint}`, {
        method: a === "Cancel draft" ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          ...(endpoint === "fulfillment"
            ? { state: a }
            : endpoint === "runner"
              ? { action: "accept" }
              : {}),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.approvalUrl) window.location.assign(d.approvalUrl);
      else window.location.reload();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {actions.map((a) => (
          <button key={a} disabled={busy} onClick={() => action(a)}>
            {a.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      <p role="status">{status}</p>
    </>
  );
}
