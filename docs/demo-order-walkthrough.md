# Demonstrate an order without PayPal

Use **Enter Demo Mode** and keep the same browser session throughout. Customer, Vendor and Runner are three fictional accounts in your own private workspace. Switching profiles keeps the same orders and inventory; exiting Demo Mode and entering again starts a fresh workspace.

## Walkthrough

1. As **Customer**, find a fictional product such as Habanero Cinnamon Rolls, add it to the cart and prepare the vendor order.
2. On the dashboard, choose **Simulate demo payment**. The order becomes PAID for the walkthrough and displays **SIMULATED DEMO ORDER — NO PAYPAL CHARGE**.
3. Switch to **Vendor**. Choose **Accept demo order**, then **Find a runner**.
4. Switch to **Runner**. Confirm availability, transportation and a trip to the vendor, then **Accept run**. Initial demo runner availability expires after one hour; it can be renewed in the dashboard.
5. Switch to **Vendor** and choose **Mark ready for pickup**.
6. Switch to **Runner** and choose **Confirm pickup**, **Start delivery**, then **Confirm delivered**.
7. Switch to **Customer** and choose **Confirm order complete**. Customer recognition and runner rewards update once. An optional detailed review adds five customer recognition points, regardless of its star rating.

Each simulated order includes a next-step guide. The unassigned runner's offer also identifies it as simulated. This walkthrough reserves fictional inventory and updates all three demo accounts; it has no effect on another visitor's workspace, real accounts or public vendor reputation.

Before a runner is assigned, the Vendor can choose **Cancel simulated order**. Inventory is restored once and the canceled simulation remains in history. This performs no PayPal refund.

## Payment distinction

The simulation creates a separate `DEMO_PAYMENT` ledger entry with `simulated=true`. Its PayPal order, capture and refund IDs stay empty. Captured Sandbox payment totals stay unchanged, and actual vendor/runner payouts remain zero. Demo order values have a separate summary and retain their simulation label after completion or cancellation.

**Use PayPal Sandbox instead** is a separate option for an actual Sandbox approval/capture test. Once a draft starts PayPal checkout, it cannot be converted to a simulation; prepare a new draft for the simulated walkthrough. Existing pending and captured PayPal transactions remain genuine Sandbox records and cannot be simulated or canceled through the demo-only endpoint.

## Setup

Run [the simulation upgrade SQL](sql/demo-order-simulation-upgrade.sql) once after the community recognition upgrade. The migration adds explicit simulation provenance, private-session checks, payment guards and separate demo ledger support. It can be retried without awarding points twice or changing existing financial records. Existing Demo Mode configuration is reused; this feature needs no additional API key.

## Verification

All 93 unit/database tests and 52 browser checks passed, covering desktop and 360/390/430px widths. The browser walkthrough uses the actual simulation button through completion and review, checks zero PayPal IDs and genuine customer-payment rows, and verifies customer/runner rewards. Access tests cover missing tickets, wrong roles, real accounts, other workspaces and expired sessions. Cancellation restores inventory once and leaves actual payouts at zero. Genuine pending/captured payment regressions and mixed-history payment labels remain covered.

The [sanitized browser report](evidence/demo-order-simulation-2026-10-27.json) and [mobile walkthrough screenshot](screenshots/demo-order-simulation-2026-10-27/mobile-360-SIMULATED-DEMO-customer-completed-order.png) document these local checks. Raw authentication traces and credentials are excluded.

Production source `efd4ce952564d61e6ec7ad4fad74d97cc63d7e39` is READY on `runners.aibrylabs.com`, and the simulation SQL is active. A fresh private demo completed the full hosted workflow with four simulated ledger rows, no PayPal identifiers, fifteen customer points and ten runner reward points. Replaying simulation did not duplicate records; repeating completion returned 409 with state, ledger and rewards unchanged. Customer captured totals and actual payouts stayed zero. All three preserved PayPal orders and their ledger fingerprints were unchanged before and after the check. The demo exited successfully. See [live evidence](evidence/demo-order-simulation-production-2026-10-27.json) and the [live customer payment summary](screenshots/demo-order-simulation-2026-10-27/LIVE-PRODUCTION-SIMULATED-customer-payment-summary.png).
