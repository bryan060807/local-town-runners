# One gift, one shop, one neighbor

Use **Enter Demo Mode** and keep the same browser session throughout. Customer, Vendor and Runner are three fictional accounts in your own private workspace. Switching profiles keeps the same orders and inventory; exiting Demo Mode and entering again starts a fresh workspace and does not erase the old history.

The presentation story uses **one Handmade River Mug at $28.00 from Riverbend Market & Goods**. A fresh demo runner already has a fictional trip to that shop. Start a fresh demo shortly before rehearsing; initial runner availability and that trip expire after one hour. No real goods, trip, PayPal charge or payout occurs.

## Walkthrough

1. **Customer — see the connection.** In **Neighborhood Connection**, choose **A gift under $30** and select the **Handmade River Mug** find if needed. Confirm the current $28.00 price, Riverbend Market & Goods and the declared-trip candidate. This preview does not reserve stock, assign a runner or create an order. The other intent switches, **Something to eat** and **Made nearby**, explore different eligible catalog finds without changing the order workflow.
2. **Customer — ask and review.** Choose **Ask Sidekick** to carry the selected mug into the assistant, then ask **“Who could bring it?”** for current matching options. Ask **“Get me one.”** This opens a reviewable quote; it does not reserve inventory or charge. Keep quantity 1, review the fictional delivery address, then choose **Prepare order**. For a direct path, **Review this find** opens the same listing's details; vendor/item search also remains available. Browsing and the connection preview do not require a working map.
3. **Customer — start the simulated walkthrough.** On the dashboard, choose **Simulate demo payment**. The order becomes PAID for the walkthrough and displays **SIMULATED DEMO ORDER — NO PAYPAL CHARGE**. Follow its **Up next** guide.
4. **Vendor — accept the order.** Use **Switch demo profile** to view Vendor. Choose **Accept demo order**, then **Find a runner**.
5. **Runner — accept the pickup.** Switch to Runner and choose **Accept run** for this order. If availability has expired, renew it with **Available for the next hour** and confirm a trip to Riverbend Market & Goods before continuing. Runner acceptance is required even when the connection preview or assistant found an existing trip.
6. **Vendor — prepare the item.** Switch to Vendor and choose **Mark ready for pickup**.
7. **Runner — complete the handoff.** Switch to Runner. Choose **Confirm pickup**, **Start delivery**, then **Confirm delivered** in order.
8. **Customer — confirm the outcome.** Switch to Customer and choose **Confirm order complete**. The guide shows **Walkthrough complete**. Customer recognition and runner rewards update once. An optional detailed review adds five customer recognition points, regardless of its star rating.

The profile bar identifies the role you are viewing. **How the demo works** explains the three responsibilities, and each simulated order names the next role and action. The unassigned runner's offer also identifies it as simulated. This walkthrough reserves fictional inventory and updates all three demo accounts; it has no effect on another visitor's workspace, real accounts or public vendor reputation. Actual payouts stay $0.00.

The connection preview uses available catalog data and current declared trips; it is not an autonomous AI booking. When no eligible current trip exists for the selected find, the panel shows a no-trip state, not a placeholder neighbor. Its trip-window countdown describes the declaration's expiry, not a delivery ETA. Existing server matching, runner acceptance and payment verification remain authoritative.

For a short presentation, use the [three-minute story](hackathon-demo.md). Rehearse the full handoff before timing it. A clearly labeled recording is a backup when live page transitions would rush the story; preserve the required confirmations and distinguish a recorded rehearsal order from the current live order.

Before a runner is assigned, the Vendor can choose **Cancel simulated order**. Inventory is restored once and the canceled simulation remains in history. This performs no PayPal refund.

## Payment distinction

The simulation creates a separate `DEMO_PAYMENT` ledger entry with `simulated=true`. Its PayPal order, capture and refund IDs stay empty. Captured Sandbox payment totals stay unchanged, and actual vendor/runner payouts remain zero. Demo order values have a separate summary and retain their simulation label after completion or cancellation.

The three-minute presentation closes with a separately labeled slide of an existing verified $4.50 PayPal Sandbox payment. It demonstrates genuine capture/webhook/ledger verification, not a payment for the new $28 simulated mug order. Prepare that sanitized evidence in advance; the presentation does not require a new provider transaction or administrator sign-in.

**Use PayPal Sandbox instead** is a separate option for an actual Sandbox approval/capture test. Once a draft starts PayPal checkout, it cannot be converted to a simulation; prepare a new draft for the simulated walkthrough. Existing pending and captured PayPal transactions remain genuine Sandbox records and cannot be simulated or canceled through the demo-only endpoint.

## Setup

The existing hosted project already has the simulation upgrade; this presentation update requires no additional SQL or API key. Fresh installations should follow the complete migration sequence in the [README](../README.md). For an older installation following its documented upgrade path, [the simulation upgrade SQL](sql/demo-order-simulation-upgrade.sql) follows the community recognition upgrade and adds explicit simulation provenance, private-session checks, payment guards and separate demo ledger support. Do not reset or reseed the hosted project to rehearse.

## Verification

The initial simulation release passed all 93 unit/database tests and 52 browser checks, covering desktop and 360/390/430px widths. The browser walkthrough uses the actual simulation button through completion and review, checks zero PayPal IDs and genuine customer-payment rows, and verifies customer/runner rewards. Access tests cover missing tickets, wrong roles, real accounts, other workspaces and expired sessions. Cancellation restores inventory once and leaves actual payouts at zero. Genuine pending/captured payment regressions and mixed-history payment labels remain covered. The [hardening report](hardening-2026-10-27.md) records the expanded regression suite and latest deployed checks.

The [sanitized browser report](evidence/demo-order-simulation-2026-10-27.json) and [mobile walkthrough screenshot](screenshots/demo-order-simulation-2026-10-27/mobile-360-SIMULATED-DEMO-customer-completed-order.png) document these local checks. Raw authentication traces and credentials are excluded.

The initial hosted simulation verification used production source `efd4ce952564d61e6ec7ad4fad74d97cc63d7e39` on `runners.aibrylabs.com`, with the simulation SQL active. A fresh private demo completed the full hosted workflow with four simulated ledger rows, no PayPal identifiers, fifteen customer points and ten runner reward points. Replaying simulation did not duplicate records; repeating completion returned 409 with state, ledger and rewards unchanged. Customer captured totals and actual payouts stayed zero. All three preserved PayPal orders and their ledger fingerprints were unchanged before and after the check. The demo exited successfully. See the [initial live evidence](evidence/demo-order-simulation-production-2026-10-27.json) and [initial live customer payment summary](screenshots/demo-order-simulation-2026-10-27/LIVE-PRODUCTION-SIMULATED-customer-payment-summary.png); a fresh walkthrough of the hardened application has its own [current evidence](evidence/hardening-live-simulation-2026-10-27.json).
