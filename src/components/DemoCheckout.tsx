"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import PaymentActions from "./PaymentActions";

export default function DemoCheckout({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function simulate() {
    if (busy) return;
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/demo/orders/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || "Demo simulation unavailable");
      setStatus("Demo payment simulated. No PayPal charge was made.");
      router.refresh();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Demo simulation unavailable",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="demo-checkout">
      <p>
        Walk through this order with your demo Customer, Vendor and Runner.
        Simulation stays in your private demo and makes no PayPal charge.
      </p>
      <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <button type="button" className="primary" onClick={simulate}>
          {busy ? "Simulating demo payment…" : "Simulate demo payment"}
        </button>
        <details>
          <summary>Use PayPal Sandbox instead</summary>
          <p>
            This option opens PayPal for buyer approval. Once PayPal checkout
            starts, prepare a new draft if you want to use simulation.
          </p>
          <PaymentActions orderId={orderId} pending={false} />
        </details>
      </fieldset>
      <p role="status">{status}</p>
    </div>
  );
}
