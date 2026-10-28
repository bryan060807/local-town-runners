# Local Town Runners — Fred’s three-minute errand

“Fred wants two cinnamon rolls. A local baker has them. A neighbor is already heading to the shop. Sidekick helps Fred work out his choices, then the people involved make the handoff happen.”

Keep one outcome in view: **two Habanero Cinnamon Rolls at $4.50 each, $9.00 total, from Demo Hearth Bakery**. Begin with an open-ended bakery request, show the AI compare combinations, then change your mind. The payoff is the same exact two rolls moving from a reviewed plan into the cart and through a completed simulated delivery. Louisiana, Missouri is the starting community; the need can exist in another town.

## Before presenting

Open https://runners.aibrylabs.com and choose **Enter Demo Mode**. Keep the same browser session throughout. **Switch demo profile** changes your view while preserving this private workspace’s cart, orders and inventory. Fred is the narrated customer; the fictional Customer profile on screen is Alex Carter. Say once: “These are fictional profiles in my private demo. This order uses an explicitly simulated payment; no PayPal charge or payout is made.” Keep the visible labels.

Before filming, switch to Runner **Jordan Ellis**. In **Runner availability**, choose **Available for the next hour**. Under **I’m already going to…**, select **Demo Hearth Bakery**, then **Share trip for one hour**. Return to Customer in the **same workspace**. The fresh demo’s initial trip is to Riverbend Market & Goods, so do this bakery setup deliberately. Availability and the trip expire after one hour; renew them if needed. This is a fictional declaration, and Jordan still has to accept the run.

Start with an empty Customer cart and stock for two rolls. Open **Sidekick Errand Planner** and use **Bakery stop under $20** as the starting point. It fills this request; choose **Build an errand plan** to submit it:

> I need two cinnamon rolls and one more bakery item to share, under $20 total. Compare two combinations from one shop and check pickup.

Then refine the same conversation:

> Actually just the two rolls.

Use [the planner guide](sidekick-errand-planner.md) for the detailed behavior and release evidence. Rehearse with the configured model: wording, option order and valid combinations may vary. With the current seeded catalog, two rolls plus a Berry Scone Pair total **$16.00**, and two rolls plus a Honey Oat Loaf total **$17.50**. The revised two-roll plan totals **$9.00**. Food ingredients, portions and suitability still need vendor confirmation.

Have one sanitized proof slide ready for the close, labeled **Separate verified PayPal Sandbox payment — $4.50**. Use the existing evidence below; the presentation needs no new PayPal request or administrator sign-in.

## Three-minute story

| Time      | Show                                                                                                                         | Say                                                                                                                                                                                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:15 | The bakery request in **Sidekick Errand Planner**                                                                            | “Fred has a small errand and a $20 budget. Let’s work out his options with a local shop.”                                                                                                                                             |
| 0:15–0:55 | **Build an errand plan**, compare the combinations, then send **“Actually just the two rolls.”** with **Update my plan**     | “Sidekick compares whole baskets, remembers the request and adapts when Fred changes his mind. The server checks the actual products, quantities and totals.” Show the **AI-assisted plan** badge and the $9 revision.                |
| 0:55–1:20 | **Review this option** → **Save these choices to cart** → **View cart**                                                      | “These are the two rolls he chose. Saving sets their exact quantity in his cart. He still reviews the full cart and address before an order exists.” Point out Jordan’s declared trip while it is current.                            |
| 1:20–1:35 | Review the fictional delivery address, choose **Prepare this vendor order**, then **Simulate demo payment** on the dashboard | “Fred explicitly prepares the order. This payment is simulated inside the demo.” Show **SIMULATED DEMO ORDER — NO PAYPAL CHARGE**.                                                                                                    |
| 1:35–2:40 | Follow **Up next** through Vendor → Runner → Vendor → Runner → Customer                                                      | “The baker accepts. Jordan accepts the pickup. Each person confirms their part, and Fred confirms it arrived.”                                                                                                                        |
| 2:40–3:00 | The completed $9 simulated order, then the separately labeled $4.50 Sandbox proof slide                                      | “A small errand, a local sale, a neighbor’s existing trip. Actual payouts stay $0.00. Separately, this existing $4.50 PayPal Sandbox payment has a verified completed capture, signed webhook and one customer-payment ledger entry.” |

The handoffs are Vendor **Accept demo order** → **Find a runner**; Runner **Accept run**; Vendor **Mark ready for pickup**; Runner **Confirm pickup** → **Start delivery** → **Confirm delivered**; Customer **Confirm order complete**. A review can wait until questions. The [earlier mug walkthrough](demo-order-walkthrough.md) documents the same fulfillment controls with a different item; use this guide’s bakery, quantity and planner steps for the current pitch.

These are narration budgets. Time a rehearsal with real model latency and page transitions. Use a clearly labeled recording of a completed rehearsal if the full handoff would rush three minutes, or allow a longer hands-on demonstration. Preserve required confirmations and distinguish a recording from the current live order. Keep a backup recording ready.

## What the AI demonstration proves

The planner makes an actual model request to interpret the need, compare alternatives or ask a clarification, then revise within its short conversation. **How this plan was made** identifies the model and catalog scope. The server re-reads the visible catalog after the model responds and independently checks prices, stock, whole-option budgets, constraints and current pickup candidates. The model cannot reserve stock, prepare an order, charge or assign Jordan.

If **Catalog suggestions — AI unavailable** appears, describe the fallback accurately. Use a clearly labeled recording of an earlier actual model run if available; catalog suggestions are not evidence of AI reasoning. The Neighborhood Connection preview and familiar quick assistant phrases remain useful browsing paths, but their catalog rules alone do not demonstrate the new planner’s model interpretation.

Saving a plan uses the existing cart one item at a time. A failed multi-item save can leave some choices saved; read its result and check the cart before retrying. Retrying sets quantities rather than adding duplicate units. Other pre-existing cart items are outside the plan’s displayed total. The two-roll story keeps this boundary easy to see.

## PayPal proof and questions

Keep genuine Sandbox evidence separate from the new $9 simulated order. Three existing marketplace Sandbox payments total **$44.00 USD**, each matched to a PAID order, a completed signed webhook and exactly one customer-payment ledger entry. The [Sandbox verification report](phase-4.3-sandbox-verification.md) includes the $4.50 capture `17M125027B131373Y` for order `29945be0-236d-4a80-845a-36cf43b4fb1a`. A fresh private demo does not inherit it. Show sanitized evidence or an authorized administrator’s own view; do not initiate another payment during the pitch. Vendor and runner allocations remain simulated, including for genuine Sandbox captures; actual payouts stay zero.

For questions, use [architecture](architecture.md), [security](security.md), [community recognition](community-recognition.md) and the [hardening report](hardening-2026-10-27.md). Matching uses approximate proximity and temporary declared trips; it does not promise a road ETA or delivery. Live payments, real payouts and sponsored billing are outside this showcase. Final planner release checks and hosted evidence belong in the planner guide once verified; earlier releases’ test totals do not certify this change.

Before submitting, rehearse on your phone and retain the AI provenance, fiction and simulation labels in screenshots and recordings. Keep credentials, real addresses and private application documents off screen. Use the operator’s own submission account for the final video, repository and deployed URL.
