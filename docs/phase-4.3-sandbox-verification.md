# Phase 4.3 — accelerated Sandbox verification

October 11, 2026 (America/Chicago). **Preflight and unpaid test draft verified; new payment awaits explicit authorization.** No new PayPal order, approval, capture, refund, payout or financial reconciliation was initiated by this phase.

## Actual read-only findings

Production is `https://runners.aibrylabs.com`. Its READY deployment is `dpl_6taLk9mw9BiKujoEonwXhrehV2Sm`, code revision `dd2e4258b962387236de01e2a602e18c5686980b`. Hosted `phase42_ready` returns true. The demo-entry API and fictional $4.50 listing respond successfully. Existing payment controls use server-derived USD totals, explicit buyer approval and capture, canonical capture verification, and durable capture-attempt protection. PayPal's API base remains fixed to Sandbox.

| Preserved order                                     | PayPal order        | Merchant capture    | Provider state           | Local state     |
| --------------------------------------------------- | ------------------- | ------------------- | ------------------------ | --------------- |
| `8ffc44db-c4a8-43fd-b67b-aa7ff8943b5c` — $35.00 USD | `2H896866K62686904` | `2RA30218PE716183N` | PENDING / ECHECK         | PENDING_PAYMENT |
| `3e48d73e-3ee5-4102-8877-7eaae17ea8b4` — $4.50 USD  | `6H801422XW275760H` | `44G98547CY6197247` | PENDING / PENDING_REVIEW | PENDING_PAYMENT |

Both canonical orders have one correctly associated purchase unit, the correct USD total and one pending capture, even though their parent order status is COMPLETED. Both identify seller merchant `K6S8CVBZ2FSVL`; their buyers differ from that seller. Neither has a local confirmed capture, payment event or ledger entry. All original order, recovery, payment-event and ledger records hashed identically before and after the read-only investigation. Nothing was reconciled, reset, edited or deleted for either order.

Cloud Sandbox OAuth succeeds with HTTP 200 and its credentials can read both merchant captures. Vercel lists Production bindings for PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_WEBHOOK_ID and APP_URL. Sensitive credential values are masked by its API; their exact values were not extracted, copied, replaced or claimed independently compared. Previous authenticated production recovery worked, but final new-payment evidence must come from the production path.

The available Sandbox app now has registered webhook `5K366015HE7061019` at `https://runners.aibrylabs.com/api/webhooks/paypal`. It matches the cloud PAYPAL_WEBHOOK_ID and includes PAYMENT.CAPTURE.COMPLETED and PAYMENT.CAPTURE.PENDING. Its other events are ignored by the existing payment processor. The webhook ID was recently updated in Vercel, and the current deployment is READY. Exact active Vercel webhook-ID equality still requires operator confirmation or successful authentic delivery.

PayPal's actual event history contains pending event `WH-6DT31871VT560584P-7EW198456P304860R` for capture `44G98547CY6197247`. This proves event generation, not successful delivery or signature verification. A pending event correctly creates no payment credit; it is not recorded as a completed payment event. No event for an old transaction was replayed.

## Can balance funding complete immediately?

**It is a valid Sandbox test route, but immediate completion is not yet verified for these accounts.** Official PayPal documentation supports distinct Personal buyer and Business merchant accounts, editable Sandbox balances and custom/duplicated accounts. Use a separate US Personal buyer with a sufficient available USD PayPal balance and select that balance explicitly in checkout. This avoids selecting a bank-funded eCheck. The existing pending-review capture demonstrates that a separate buyer and a small amount alone do not guarantee completion.

Merchant Orders/Captures APIs do not expose the developer dashboard's editable buyer balance or all seller review/account settings. No buyer password or developer-browser session is available to this task. Buyer balance, selectable funding source, seller account readiness and any deliberate test-review setting therefore require operator inspection. This report does not assert that adding a balance overrides PayPal review, that every UI exposes a payment-review toggle, or that a card guarantees immediate settlement.

Official sources retrieved successfully over verified HTTPS during this phase:

- [Sandbox accounts](https://developer.paypal.com/sandbox-testing/accounts): Personal versus Business roles, custom account defaults, and editing PayPal balances when duplicating accounts.
- [Orders v2 OpenAPI](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/checkout_orders_v2.json): capture status COMPLETED versus PENDING and reasons including ECHECK and PENDING_REVIEW.
- [Webhook OpenAPI](https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/notifications_webhooks_v1.json): registration and event-history interfaces.

## Prepared test specification

Label: **PHASE 4.3 — SINGLE BALANCE-FUNDED SANDBOX VERIFICATION**.

Product: **Habanero Cinnamon Rolls**, fictional Demo Hearth Bakery. Quantity **1**, total **$4.50 USD**, using existing stock and price. The public template listing is `7197dfe0-af15-40ee-a7e7-ecd7f783601e`; an isolated customer workspace has its own copy and listing ID. Use its displayed price, not a hard-coded client price. Do not add other cart items or change either existing pending order.

The operator prepared marketplace order **`29945be0-236d-4a80-845a-36cf43b4fb1a`** in their own session. The hosted read verifies state DRAFT, quantity 1, total 450 cents, Habanero Cinnamon Rolls from fictional Demo Hearth Bakery, an active customer workspace matching the vendor workspace, no suspension, null PayPal order/capture IDs, zero ledger/payment events and payout_status SIMULATED. This is the exact Phase 4.3 test association. The operator reports approximately $5,000 in their Personal buyer's PayPal balance; that is operator-reported evidence, not a merchant-API balance read. Final checkout funding-source selection still requires inspection in PayPal. No operator account was impersonated and no old demo identity was reopened. Draft preparation reserves fictional inventory and does not call PayPal. The app's anonymous Preview order does not create a persistent draft.

## Operator steps, with a transaction boundary

1. In [PayPal Sandbox Accounts](https://developer.paypal.com/developer/accounts), inspect a **Personal** buyer distinct from Business seller `K6S8CVBZ2FSVL`. Confirm an available USD PayPal balance comfortably above $4.50. View/Edit Account is the documented account-management entry. If necessary, use Create Custom Account or Duplicate Account, set its test balance, and set a password. Enter passwords only into PayPal. Keep the seller/app that owns the old transactions in place.
2. Check the Business seller has no unfinished verification/receiving setup or intentionally enabled review test setting visible in its dashboard. Resolve only prerequisites for the new test; do not Accept, refund, release or otherwise modify either preserved transaction.
3. Confirm the existing app is under **Sandbox Apps & Credentials**, that Vercel uses its client ID/secret, and that its active PAYPAL_WEBHOOK_ID is `5K366015HE7061019`. The production webhook must subscribe to capture-completed and capture-pending. If an environment binding actually changes, redeploy before the test. Do not enable Live or payouts.
4. Open production, enter **Demo Customer**, select Habanero Cinnamon Rolls, quantity 1, and choose **Prepare order**. The fictional delivery address is retained. Copy the new UUID from `/dashboard?prepared=<UUID>`. Stop before **Pay with PayPal Sandbox** and report that UUID.
5. **Wait for explicit authorization of this one $4.50 test.** The Phase 4.3 brief expressly requires it; drafting an order or confirming account setup does not authorize payment.
6. After authorization, use the exact new order's **Pay with PayPal Sandbox** button. In PayPal, sign out of any seller session, sign into the separate Personal buyer, and select **PayPal balance** if it is available. Inspect the selected source before the final approval. If only a bank/eCheck is offered, stop without approving and report that limitation.
7. Approve once, return to the marketplace, and use **Confirm approved payment** only for that new order if it is offered. Never use a pending old order for the new test or repeatedly attempt capture. Report the new order UUID and displayed result; do not share passwords, session cookies or tokens.

## Completion evidence required after authorization

| Check                                                              | Present result                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| New marketplace draft and operator authorization                   | Draft verified; explicit authorization pending                      |
| Buyer-selected PayPal balance                                      | Awaiting operator                                                   |
| PayPal order COMPLETED and exactly one capture COMPLETED           | Not yet attempted                                                   |
| One purchase unit; matching custom_id, provider binding, USD $4.50 | Not yet verified for new order                                      |
| Local PAID with same merchant capture                              | Not yet verified                                                    |
| Authentic signed capture-completed webhook accepted                | Not yet verified                                                    |
| Exactly one CUSTOMER_PAYMENT ledger row, amount 450 cents          | Not yet verified                                                    |
| Repeated read-only reconciliation leaves capture/ledger unchanged  | Not yet verified                                                    |
| Vendor and runner earnings simulated; no payout                    | Existing implementation verified by regression; new records pending |

The existing financial schema intentionally stores **four total ledger rows** on first payment: one CUSTOMER_PAYMENT plus simulated vendor, runner and platform allocations. For $4.50 they must be 450, 360, 67 and 23 cents respectively. The customer row records actual Sandbox proof; it does not represent a Live charge. A requirement for one payment entry is satisfied by one CUSTOMER_PAYMENT, not by deleting established allocation rows.

Use the genuine provider event ID and local payment-event association, together with production webhook/signature evidence, to verify signed processing. Reading a provider event or successfully using the simulator alone is insufficient. Existing route code verifies the PayPal signature before reading/confirming an application order; do not weaken that boundary. If manual recovery confirms first, authentic webhook processing must still be shown separately. A replay of the new signed event is allowed only after its identity and new-order association are known; never replay old financial events for this phase.

`scripts/phase43-payment-audit.mjs` is a reusable **GET-only provider / SELECT-only database** evidence collector (OAuth POST only). Run with Node's supported proxy and system CA options. An optional new marketplace UUID adds canonical status, ledger and real event-history checks. It never calls checkout, capture, approval, confirmation RPC or webhook resend. Its output omits credentials, buyer identity, addresses and provider token bodies. It exposes history pagination and does not invent delivery status absent from PayPal's response.

## Regression and release evidence

- 79 existing automated regression tests passed; zero failures, skips or cancellations. These include financial/RLS/duplicate-capture and webhook signature cases; fixture passes are not a real new capture.
- Lint and type checking passed. The evidence collector executed successfully, including an existing-order argument and actual PayPal event history.
- Two independent evidence reads verified unchanged hashes for both preserved transactions.
- Production demo availability, listing availability and hosted schema readiness were checked successfully.
- No application source or database schema change was necessary. No production deployment was initiated. Work is confined to audit tooling and documentation; the existing READY release remains active.
- Sanitized actual provider/database evidence is supplied under `docs/evidence/phase-4.3/`. No completed-payment screenshot or mock success is represented as genuine Sandbox proof.

## If the next capture also remains pending

Preserve it and report the canonical pending reason. Do not repeat payment or force PAID. If buyer balance is unavailable, prepare/configure a suitable Personal Sandbox buyer before requesting a separately authorized attempt. If PayPal reviews balance-funded captures, inspect new-test seller/buyer readiness and any supported Sandbox review settings, or seek PayPal developer support. A different Sandbox merchant/app would require explicit configuration changes and retention of access to the old merchant's transactions; it is not an automatic shortcut. Continue demonstrating truthful pending status plus local fixture tests labeled as simulated until a genuine COMPLETED Sandbox capture is observed.

**Definition of done remains open.** No new financial transaction has been authorized or executed; completed capture, signed delivery, PAID transition and new-order exactly-once payment evidence remain pending.
