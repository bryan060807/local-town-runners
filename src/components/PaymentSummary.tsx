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
  demo_simulated?: boolean;
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
  const orderById = new Map(orders.map((order) => [order.id, order]));
  const simulationIds = new Set([
    ...orders.filter((order) => order.demo_simulated).map((order) => order.id),
    ...ledger
      .filter(
        (entry) =>
          entry.kind === "DEMO_PAYMENT" ||
          (entry.kind === "CUSTOMER_PAYMENT" && entry.simulated),
      )
      .map((entry) => entry.order_id),
  ]);
  const verifiedPayments = ledger.filter(
    (entry) =>
      entry.kind === "CUSTOMER_PAYMENT" &&
      !entry.simulated &&
      !simulationIds.has(entry.order_id) &&
      Boolean(orderById.get(entry.order_id)?.paypal_capture_id),
  );
  const simulatedPayments = ledger.filter(
    (entry) =>
      orderById.has(entry.order_id) &&
      entry.simulated &&
      ["DEMO_PAYMENT", "CUSTOMER_PAYMENT"].includes(entry.kind),
  );
  const activeSimulations = simulatedPayments.filter(
    (entry) => orderById.get(entry.order_id)?.state !== "CANCELLED",
  );
  const entries =
    role === "customer"
      ? verifiedPayments
      : ledger.filter(
          (entry) => entry.kind === kind && orderById.has(entry.order_id),
        );
  const simulationOnly =
    simulationIds.size > 0 &&
    orders.every((order) => simulationIds.has(order.id));
  const eligible = entries.filter((l) =>
    orders.some(
      (o) =>
        o.id === l.order_id &&
        o.refund_state !== "COMPLETED" &&
        (role === "customer" || o.state !== "CANCELLED"),
    ),
  );
  const completed = eligible.filter((l) =>
    orders.some((o) => o.id === l.order_id && o.state === "COMPLETED"),
  );
  const total = (list: Ledger[]) =>
    list.reduce((s, l) => s + Number(l.amount_cents), 0);
  return (
    <section className="simple-card payment-summary">
      <span className="eyebrow">
        {simulationOnly ? "DEMO SIMULATION" : "PAYPAL SANDBOX"}
      </span>
      <h2>
        {role === "customer"
          ? "Your payment history"
          : `${role === "vendor" ? "Vendor" : "Runner"} earnings`}
      </h2>
      {simulationOnly ? (
        <p>These orders use demo simulation. No PayPal charge was made.</p>
      ) : (
        <p>
          Platform checkout configuration:{" "}
          {configured
            ? "Sandbox credentials configured; buyer approval and provider verification required."
            : "Not configured."}
        </p>
      )}
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
            {simulationIds.has(l.order_id)
              ? "Simulated demo order · internal allocation only"
              : l.simulated
                ? "Internal allocation only"
                : "Verified Sandbox capture"}
            {simulationIds.has(l.order_id)
              ? orderById.get(l.order_id)?.state === "CANCELLED"
                ? " · Simulation canceled"
                : ""
              : orderById.get(l.order_id)?.refund_state === "COMPLETED"
                ? " · Refunded"
                : ""}
          </p>
        ))}
      </details>
      {role === "customer" && simulatedPayments.length > 0 && (
        <div className="demo-payment-history">
          <h3>Simulated demo orders</h3>
          <p>
            <strong>
              Simulated order value: {money(total(activeSimulations))}
            </strong>
          </p>
          <p>
            No PayPal charge for these simulated orders. Their values are
            excluded from captured Sandbox payments.
          </p>
          <details>
            <summary>
              Simulated order history ({simulatedPayments.length})
            </summary>
            {simulatedPayments.map((entry) => (
              <p key={entry.order_id}>
                {money(Number(entry.amount_cents))} · Order {entry.order_id} ·
                Simulated demo payment · No PayPal charge
                {orderById.get(entry.order_id)?.state === "CANCELLED"
                  ? " · Simulation canceled"
                  : ""}
              </p>
            ))}
          </details>
        </div>
      )}
    </section>
  );
}
