import { money } from "@/lib/catalog";
type Ledger = {
  order_id: string;
  kind: string;
  amount_cents: number | string;
  simulated: boolean;
};
type Order = {
  id: string;
  state: string;
  refund_state: string;
  paypal_capture_id: string | null;
};
export default function PaymentSummary({
  role,
  ledger,
  orders,
  configured,
}: {
  role: "vendor" | "runner" | "customer";
  ledger: Ledger[];
  orders: Order[];
  configured: boolean;
}) {
  const kind =
    role === "vendor"
      ? "VENDOR_ALLOCATION"
      : role === "runner"
        ? "RUNNER_ALLOCATION"
        : "CUSTOMER_PAYMENT";
  const entries = ledger.filter((l) => l.kind === kind);
  const eligible = entries.filter((l) =>
    orders.some((o) => o.id === l.order_id && o.refund_state !== "COMPLETED"),
  );
  const completed = eligible.filter((l) =>
    orders.some((o) => o.id === l.order_id && o.state === "COMPLETED"),
  );
  const total = (list: Ledger[]) =>
    list.reduce((s, l) => s + Number(l.amount_cents), 0);
  return (
    <section className="simple-card payment-summary">
      <span className="eyebrow">PAYPAL SANDBOX</span>
      <h2>
        {role === "customer"
          ? "Your payment history"
          : `${role === "vendor" ? "Vendor" : "Runner"} earnings`}
      </h2>
      <p>
        Platform checkout configuration:{" "}
        {configured
          ? "Sandbox credentials configured; buyer approval and provider verification required."
          : "Not configured."}
      </p>
      {role !== "customer" ? (
        <>
          <p>
            <strong>
              Simulated {role === "vendor" ? "Vendor" : "Runner"} Payout — Demo
              Only
            </strong>
          </p>
          <p>
            Recipient account: not connected. No PayPal transfer has been sent.
          </p>
          <div className="balance-grid">
            <div>
              <small>Pending allocations</small>
              <strong>{money(total(eligible) - total(completed))}</strong>
            </div>
            <div>
              <small>Completed-order allocations</small>
              <strong>{money(total(completed))}</strong>
            </div>
            <div>
              <small>Actual payouts</small>
              <strong>{money(0)}</strong>
            </div>
          </div>
        </>
      ) : (
        <p>
          Captured Sandbox payments: {money(total(entries))}. Refunded:{" "}
          {money(total(entries) - total(eligible))}. Refund status is shown on
          each order.
        </p>
      )}
      <details>
        <summary>Transaction history ({entries.length})</summary>
        {entries.map((l) => (
          <p key={l.order_id}>
            {money(Number(l.amount_cents))} · Order {l.order_id} ·{" "}
            {l.simulated
              ? "Internal allocation only"
              : "Verified Sandbox capture"}
            {orders.find((o) => o.id === l.order_id)?.refund_state ===
            "COMPLETED"
              ? " · Refunded"
              : ""}
          </p>
        ))}
      </details>
    </section>
  );
}
