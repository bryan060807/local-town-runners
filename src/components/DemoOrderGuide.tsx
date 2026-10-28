import styles from "./DemoJourney.module.css";

const steps: Record<string, { title: string; action: string }> = {
  PAID: {
    title: "Up next: Vendor",
    action: "Accept this demo order, then choose Find a runner.",
  },
  VENDOR_ACCEPTED: {
    title: "Up next: Vendor",
    action: "Choose Find a runner to offer this pickup to your demo Runner.",
  },
  RUNNER_MATCHING: {
    title: "Up next: Runner",
    action:
      "Check availability, share a trip to this vendor if needed, then choose Accept run.",
  },
  RUNNER_ASSIGNED: {
    title: "Up next: Vendor",
    action: "Choose Mark ready for pickup.",
  },
  READY_FOR_PICKUP: {
    title: "Up next: Runner",
    action: "Choose Confirm pickup.",
  },
  PICKED_UP: {
    title: "Up next: Runner",
    action: "Choose Start delivery to continue the handoff.",
  },
  OUT_FOR_DELIVERY: {
    title: "Up next: Runner",
    action: "Choose Confirm delivered after the demo handoff.",
  },
  DELIVERED: {
    title: "Up next: Customer",
    action: "Choose Confirm order complete.",
  },
  COMPLETED: {
    title: "Walkthrough complete",
    action:
      "Your demo Customer can leave a review. Demo progress and runner rewards have been updated.",
  },
  CANCELLED: {
    title: "Demo order canceled",
    action:
      "Reserved inventory was restored. No PayPal refund applies to a simulated payment.",
  },
};
export default function DemoOrderGuide({ state }: { state: string }) {
  const step = steps[state];
  return (
    <div className={`demo-order-guide ${styles.orderGuide}`} role="note">
      <strong>SIMULATED DEMO ORDER — NO PAYPAL CHARGE</strong>
      <h3>{step?.title || "Follow your demo order"}</h3>
      <p>
        {step?.action ||
          "Use the demo profile selector to follow this order across Customer, Vendor and Runner."}
      </p>
    </div>
  );
}
