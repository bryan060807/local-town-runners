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
      const endpoint = a.includes("refund")
        ? "refunds"
        : a === "Cancel draft"
          ? "orders"
          : a === "Pay with PayPal Sandbox"
            ? "checkout"
            : a === "Confirm approved payment"
              ? "capture"
              : a === "Accept run" || a === "Decline run"
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
              ? { action: a === "Decline run" ? "decline" : "accept" }
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
            {(
              {
                VENDOR_ACCEPTED: "Accept paid order",
                RUNNER_MATCHING: "Find a runner",
                READY_FOR_PICKUP: "Mark ready for pickup",
                PICKED_UP: "Confirm pickup",
                OUT_FOR_DELIVERY: "Start delivery",
                DELIVERED: "Confirm delivered",
                COMPLETED: "Confirm order complete",
              } as Record<string, string>
            )[a] || a.replaceAll("_", " ")}
          </button>
        ))}
      </div>
      {status && <p role="status">{status}</p>}
    </>
  );
}
