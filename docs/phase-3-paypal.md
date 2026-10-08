# Phase 3 PayPal Sandbox

Use the existing Sandbox integration at `https://api-m.sandbox.paypal.com`. No live-money endpoint is introduced.

## Configuration

Set `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `SUPABASE_SERVICE_ROLE_KEY` and `APP_URL=https://runners.aibrylabs.com` in Vercel Production environment settings and redeploy after changes. Use the client ID/secret and webhook ID from the **same Sandbox REST application**. Do not use Live credentials. The buyer must be a separate Sandbox personal account from Developer Dashboard → Testing Tools → Sandbox Accounts. Enter buyer credentials only on PayPal's Sandbox page.

Register `https://runners.aibrylabs.com/api/webhooks/paypal` for payment capture completion events in that Sandbox REST app. Supabase redirect settings should include the actual app domain; the existing password session flow remains in place. The webhook simulator supplies neither an application order nor a real capture and does not prove checkout.

## Customer payment evidence

The server creates the Sandbox order from the persisted application total and binds its ID to that customer/order. Browser return is approval only. Capture reconciliation fetches canonical provider data, verifies ownership/order association, USD and exact total, then captures or reconciles an existing completed capture with an idempotent request ID. Only verified capture evidence calls service-only `confirm_payment`. Signature-verified webhooks reconcile the same canonical order; database idempotency prevents duplicate ledger/reward effects.

To verify a live walkthrough, record the application order ID, provider order/capture IDs, total, persisted PAID state and four initial ledger rows. Never put credentials in the report. Replay the genuine event/capture request and confirm no duplicate financial entries. A canceled approval or failed provider request must not become PAID.

## Vendor and runner

The dashboards show platform Sandbox configuration and recipient status separately. Recipient accounts are **not connected**. Vendor and runner shares are internal allocations, labeled **Simulated Vendor Payout — Demo Only** and **Simulated Runner Payout — Demo Only**. Completed-order allocations are eligible demo earnings, not PayPal transfers. Actual payout totals remain zero. Payouts API access is not required for this phase.

## Refund verification

Only a vendor owner/admin may request a full refund of an eligible paid, unassigned order. The route calls `POST /v2/payments/captures/{capture_id}/refund` with the persisted USD total and stable `PayPal-Request-Id`. Pending/provider failures keep the database refund pending and stop fulfillment. Completed provider evidence alone enables stock restoration, CANCELLED state and a negative ledger entry. Retry cannot double-restock or double-refund locally. Check the actual Sandbox capture/refund in PayPal separately.

Refunds are full and before assignment; partial refunds, post-pickup disputes, Payouts and webhook-driven external refund ingestion are not implemented. Never reset the database to pretend an external refund occurred. A long-lived pending refund must be reconciled against the provider before any manual operational action.

## Verification status

Automated tests cover capture validation, ownership, signatures, duplicate events, failed checkout, refund validation and refund state/stock/ledger effects. Local browser fulfillment uses isolated `LOCAL-TEST-*` fixtures and proves application behavior only. Actual buyer approval, capture, live webhook and real refund require the hosted walkthrough; consult the test report for current results.
