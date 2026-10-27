const steps: Record<string, string> = {
  PAID: "Next: switch to Vendor, accept this demo order, then choose Find a runner.",
  VENDOR_ACCEPTED: "Next: as Vendor, choose Find a runner.",
  RUNNER_MATCHING:
    "Next: switch to Runner, set availability if needed, and accept this demo run.",
  RUNNER_ASSIGNED:
    "Next: switch to Vendor and mark this order ready for pickup.",
  READY_FOR_PICKUP: "Next: switch to Runner and confirm pickup.",
  PICKED_UP: "Next: as Runner, start delivery.",
  OUT_FOR_DELIVERY: "Next: as Runner, confirm delivered.",
  DELIVERED: "Next: switch to Customer and confirm order complete.",
  COMPLETED:
    "Walkthrough complete. Your demo Customer can leave a review; demo progress and runner rewards are updated.",
  CANCELLED:
    "This simulated order was canceled. Reserved inventory was restored; no PayPal refund applies.",
};
export default function DemoOrderGuide({ state }: { state: string }) {
  return (
    <div className="demo-order-guide" role="note">
      <strong>SIMULATED DEMO ORDER — NO PAYPAL CHARGE</strong>
      <p>
        {steps[state] ||
          "Use the demo profile selector to follow this order across Customer, Vendor and Runner."}
      </p>
    </div>
  );
}
