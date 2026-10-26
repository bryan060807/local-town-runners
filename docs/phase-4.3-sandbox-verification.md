# Phase 4.3 — accelerated Sandbox verification

Completion audit: **October 26, 2026 (America/Chicago). The authorized $4.50 Sandbox payment is genuinely COMPLETED, matched to its PAID marketplace order and exactly one customer-payment ledger entry.** PayPal's completed webhook automatically confirmed it on October 12. Two fresh capture-disabled reconciliation runs retained the same capture and identical ledger rows. No additional payment, refund, Live transaction or payout was initiated.

## Current completion and app visibility — October 26

All three marketplace test payments were already PAID in the hosted app **before** this completion audit. Actual canonical PayPal GETs verify one matching COMPLETED merchant capture, USD amount and marketplace custom_id for each:

| Marketplace order                      | USD amount | Merchant capture    | PayPal / local status | Customer-payment ledger entries |
| -------------------------------------- | ---------- | ------------------- | --------------------- | ------------------------------- |
| `8ffc44db-c4a8-43fd-b67b-aa7ff8943b5c` | $35.00     | `2RA30218PE716183N` | COMPLETED / PAID      | 1                               |
| `3e48d73e-3ee5-4102-8877-7eaae17ea8b4` | $4.50      | `44G98547CY6197247` | COMPLETED / PAID      | 1                               |
| `29945be0-236d-4a80-845a-36cf43b4fb1a` | $4.50      | `17M125027B131373Y` | COMPLETED / PAID      | 1                               |

These total **$44.00 USD** in actual Sandbox payments. Each has three separate simulated allocation rows; vendor and runner earnings remain simulated, payout_status is SIMULATED, and no PayPal payout was sent. The $4.50 verification order has customer payment 450 cents and vendor/runner/platform allocations 360/67/23 cents.

Its authentic provider event **`WH-9LD02972PR007470J-3RK76219XD453331M`**, PAYMENT.CAPTURE.COMPLETED, was created at `2026-10-12T05:28:26.553Z`; the app recorded that exact event/capture association at `2026-10-12T05:28:35.734377Z` (October 12, 12:28 AM America/Chicago). Independent provider event GETs verify the event type, amount, order and capture. The deployed webhook handler requires successful PayPal signature verification and canonical matching before storing that WH event ID or crediting payment. Manual recovery uses a different capture-prefixed event key. The matching real provider event and persisted WH record establish completed-webhook processing; this audit did not replay a fake signature or infer delivery merely from event generation. Historical HTTP transmission headers are not available through the provider event GET.

The other two stored completed webhook events are `WH-7L972278WR107503N-3Y434103KE246774E` ($35) and `WH-2TA490075K078542H-12C9512847400552B` (earlier $4.50). They likewise match actual provider event responses. These legitimate automatic settlement records were already present; this audit made no financial or recovery mutation to either preserved original order.

The apparent missing history is explained by **expired isolated demo accounts**, not deleted payment records. All three orders belong to non-template demo workspaces that expired October 10–11. A new Demo Customer session creates a different workspace; it does not inherit old orders. Do not reopen expired identities, move ownership or reset demo data to make the payments visible.

The existing real operator account `bryan060807@gmail.com` is email-verified, approved, unsuspended and has an approved administrator role. Exit Demo Mode, sign in with that real account and open **https://runners.aibrylabs.com/dashboard**. Existing administrator RLS permits access to all orders, including those from expired demo workspaces; all three are within the dashboard's latest 50 orders (only seven total orders were present at the audit). Expand each order's financial allocations and event history. The administrator payment recovery form also confirms an existing UUID at **https://runners.aibrylabs.com/admin/payments**. The agent did not impersonate the operator or claim to have used their authenticated browser session.

A separate display defect was reproduced: the dashboard queried roles without checking approval status, so a rejected vendor role selected Vendor earnings instead of the approved customer's payment history. Its query now filters status=approved. An actual hosted role read selects admin/customer and excludes the rejected vendor role; rendering the actual PaymentSummary component with the hosted financial projection shows **Your payment history**, **$44.00** and **3** transactions. No role approval, order ownership, demo expiration or database access policy was changed. This panel fix does not cause or retroactively claim the earlier automatic payment confirmations.

Two actual shared recovery runs against the authorized $4.50 order used allowCapture=false and a provider adapter that rejects every non-GET request. Both returned confirmed / PAID; one canonical capture and the same four ledger row IDs/values remained, including exactly one CUSTOMER_PAYMENT. One distinct capture-prefixed audit event can be recorded alongside the original webhook event; multiple confirmation sources do not duplicate financial credit. The original orders and ledger remained unchanged during this audit.

Release validation also surfaced existing npm advisories affecting Next.js 16.4.0 and Zod 4.6.5. Compatible patch updates select **Next.js / eslint-config-next 16.4.3** and **Zod 4.6.7**, with the lockfile refreshed through normal verified npm installation. No major-version or payment-flow upgrade is included. Release checks and deployment evidence are recorded below. The original completed-payment evidence was obtained while production still ran `dd2e4258b962387236de01e2a602e18c5686980b`; a new payment or database migration is not required for the display fix.

Sanitized completion evidence is under `docs/evidence/phase-4.3/completion-2026-10-26/`. The history below preserves the October 11 investigation and is not the current pending state.

## Historical preflight findings — October 11

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

Label: **PHASE 4.3 — SINGLE SANDBOX VERIFICATION (PAYPAL BALANCE UNAVAILABLE)**. Balance funding was the proposed method, but the operator's checkout screenshot shows that PayPal disabled it. The operator confirms selecting a **Sandbox credit card** for this one authorized test.

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

| Check                                                              | Present result                                                   |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| New marketplace draft and operator authorization                   | Verified; operator explicitly authorized this one $4.50 test     |
| Buyer-selected PayPal balance                                      | Unavailable; operator used a genuine Sandbox credit-card payment |
| PayPal order COMPLETED and exactly one capture COMPLETED           | Verified October 26 after provider review cleared                |
| One purchase unit; matching custom_id, provider binding, USD $4.50 | Verified                                                         |
| Local PAID with same merchant capture                              | Verified; already recorded by the completed webhook October 12   |
| Authentic signed capture-completed webhook accepted                | Verified by real provider event and matching stored WH record    |
| Exactly one CUSTOMER_PAYMENT ledger row, amount 450 cents          | Verified                                                         |
| Repeated read-only reconciliation leaves capture/ledger unchanged  | Verified twice against the actual completed capture              |
| Vendor and runner earnings simulated; no payout                    | Verified; three simulated allocation rows and no disbursement    |

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

## Historical pending-review result and live webhook evidence — October 11

The operator explicitly replied **“Authorize this one $4.50 Sandbox test”** for marketplace order `29945be0-236d-4a80-845a-36cf43b4fb1a`. Its new PayPal order is **`5B5018099M173722J`**, with one merchant capture **`17M125027B131373Y`**. Actual canonical and direct capture reads both show **PENDING / PENDING_REVIEW**, USD **4.50**; the parent order is COMPLETED. The sole purchase unit correctly binds the marketplace UUID and seller `K6S8CVBZ2FSVL`. Local state remains PENDING_PAYMENT, capture confirmation null, ledger and completed payment events empty.

The operator supplied checkout evidence showing **PayPal balance — $5,000.00 available — Unavailable at this time** and a subsequent marketplace screenshot showing this exact new order pending. The app sends a PayPal-wallet USD order and does not specify a funding preference excluding balance. The provider confirms a US buyer; it does not expose the granular reason for this checkout's balance ineligibility or the internal wallet funding choice. The report therefore does not attribute the restriction to insufficient funds, an app-forced bank payment, an unsupported-balance claim or a specific unverified account flag.

The documented Vercel runtime stream responded HTTP 200 and returned actual production records for this exact order: approved status, pending capture reconciliation, and **webhook_pending** from `/api/webhooks/paypal` at `2026-10-11T05:28:27.202Z`. The deployed handler reaches that log only after PayPal's signature verification succeeds, canonical order/amount/custom_id verification passes and the event capture ID matches. This verifies **authentic signed pending-event processing in production**. It does not prove completed-event processing. The function log records have status -1, rather than a recorded HTTP response status; the pending handler's documented response is 200. The bounded live stream later timed out after collecting those records; neither historical log completeness nor absence of other errors is inferred.

Two actual shared recovery calls with **allowCapture=false** returned the same capture_pending / PENDING_REVIEW assessment and same capture ID. They cannot create a PayPal order or call capture. Follow-up provider/database evidence confirms the sole capture and zero ledger credit remain; repeated observation writes are confined to the new test's recovery metadata. Before/after hashes for the two original orders, recovery records, ledger and payment events remain equal.

The initial provider event-history query had not yet indexed the new pending event. The operator subsequently supplied genuine dashboard delivery details for **PAYMENT.CAPTURE.PENDING event `WH-48X53773VB742825H-3H41842089926113H`**, showing SUCCESS and **HTTP 200** delivery to the production webhook at `2026-10-11T05:28:23Z`, with the response dated `2026-10-11T05:28:27Z`. An independent PayPal GET by that exact event ID verifies the capture ID, marketplace custom_id, PayPal order ID, USD amount and PENDING_REVIEW reason. These actual provider, operator delivery and production runtime records corroborate signed pending-event processing. The separate operator-supplied CHECKOUT.ORDER.APPROVED event `WH-6V316584PH625881U-5D603060LW171523D` also shows HTTP 200 delivery; its delivery SUCCESS means notification delivery, not capture completion. Buyer account VERIFIED in that approval event likewise does not constitute completed-payment proof.

The operator confirms using a **Sandbox credit card**, so this new test did not select the bank-funded eCheck shown as a default in the earlier screenshot. Their buyer receipt independently identifies transaction **`2AD46134PY6720315`**, Visa credit ending 0026, and USD 4.50. Actual GET `/v2/payments/captures/2AD46134PY6720315` returns **COMPLETED**, USD 4.50, related order `5B5018099M173722J`. A contemporaneous actual GET of canonical merchant capture **`17M125027B131373Y`** returns **PENDING / PENDING_REVIEW** for that same order and amount. This is a material distinction: buyer-side completion is verified, while canonical merchant-side completion remains blocked. The two side-specific resource IDs are not treated as duplicate capture attempts, and the buyer's COMPLETED resource is not substituted into the merchant order to bypass its pending-review proof boundary.

The operator opened the **Business seller's Sandbox Activity** for the newly authorized payment. The matching top row is October 11, 12:28 AM, gross $4.50, fee $0.65, net $3.85, status On hold. Its Actions menu offers only Add tracking, Refund and Archive; it does not offer Accept, Approve or Release. The transaction details show a **$3.85 USD hold**, held October 11, 2026, displayed release date **October 12, 2026**, and the notice: **“We’re taking a closer look at this payment. It’s required for some payments and normally takes up to 3 business days. Don’t ship until we tell you it’s ok.”** This is actual operator-supplied seller review evidence. The displayed date is an estimate, not completed-capture proof or a guarantee of settlement. No shipping, tracking, refund, archive or fabricated fulfillment action was taken.

The capture resource exposes self/refund/up links; no supported REST review-acceptance action is exposed there, and none appears in the supplied seller UI. No such action was invented or invoked. Immediate merchant-side completion is unavailable for this authorized test at the observed boundary: it requires PayPal's review decision. The original two captures remain unchanged, and no additional test payment is authorized.

The supported continuation is to check this existing payment after PayPal releases its review, or have the operator contact PayPal developer support about Sandbox review/account restrictions. A fresh Sandbox account or different funding method is not represented as a guaranteed bypass: the actual buyer is verified and the credit-card attempt still entered review. Switching the production merchant/app automatically would also compromise access to the old merchant's transaction evidence. Any separate genuine test would need its own concrete plan and explicit authorization.

For an immediate hackathon presentation, use the genuine buyer COMPLETED receipt, canonical merchant PENDING_REVIEW evidence, authentic signed pending webhook and correct pending-payment UI to demonstrate the live provider boundary honestly. Deterministic local completion/fulfillment tests may be demonstrated only with an explicit **SIMULATED — LOCAL FIXTURE** label, alongside the real Sandbox limitation. They must not be called a completed Sandbox capture or used to mark this hosted pending order PAID.

**Definition of done verified October 26:** the one authorized genuine Sandbox payment has a canonical COMPLETED merchant capture, matching PAID marketplace order, authentic completed-webhook record and exactly one correct customer-payment ledger entry. Repeated reconciliation does not recapture or duplicate ledger credit. Immediate balance funding was unavailable and this test completed only after PayPal's review cleared; the earlier acceleration limitation is preserved honestly. Live payments and real payouts remain disabled. No mock success is represented as completed Sandbox payment.

## October 26 display repair and release validation

The dashboard now selects only approved roles before choosing customer payment history or simulated vendor/runner earnings. The operator’s rejected vendor role no longer selects the vendor panel. The actual PaymentSummary component rendered with the verified financial projection reports $44.00 in three captured Sandbox transactions. Production settlement, capture IDs, consent and account role approvals are not changed by the display fix.

After the compatible security patch updates, all 79 regression tests passed with zero failures/skips/cancellations; lint, explicit type checking and the production build passed. npm audit reports zero vulnerabilities. The release uses the existing main-to-Vercel pipeline; the final production deployment observation is appended after readiness is confirmed. No additional payment, financial retry or live payout is performed during release.
