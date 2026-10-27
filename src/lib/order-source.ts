export function orderStatusLabel(order: {
  state: string;
  demo_simulated?: boolean;
}) {
  return order.demo_simulated
    ? `${order.state} — simulated demo order; no PayPal charge`
    : order.state;
}
