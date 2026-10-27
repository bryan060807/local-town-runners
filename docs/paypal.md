# PayPal Sandbox

During the initial integration, official PayPal developer pages returned HTTP 403 in this environment. The official PayPal OpenAPI sources below were fetched and read at that time:

- https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/checkout_orders_v2.json
- https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/notifications_webhooks_v1.json

OAuth uses server-only Basic authentication against `/v1/oauth2/token`. Orders v2 uses `intent: CAPTURE`, a USD purchase-unit amount derived from the database, internal order `custom_id`, and PayPal experience-context approval URLs. `PayPal-Request-Id` keys derive from the persisted order ID for create/capture retries.

## Configure

1. Create a PayPal Sandbox REST app and merchant/buyer test accounts.
2. Store client ID, client secret, webhook ID and trusted `APP_URL` securely.
3. Register the externally reachable HTTPS `/api/webhooks/paypal` endpoint for `PAYMENT.CAPTURE.COMPLETED` and `PAYMENT.CAPTURE.PENDING`. Use the webhook ID from the same Sandbox REST app as the API credentials.
4. For a fresh project, follow the [README migration and seed instructions](../README.md#database-and-operations) with the server service credential. The existing hosted project already has the current upgrades; an ordinary deployment does not require resetting or reseeding it.
5. Customer prepares an order, then explicitly chooses PayPal Sandbox on the dashboard. The server returns a PayPal approval URL.
6. After buyer approval, choose “Confirm approved payment”. A browser return URL alone never marks the order paid. Capture and/or the verified webhook confirm the canonical payment.

Webhook verification submits PayPal transmission headers, registered webhook ID and original event to `/v1/notifications/verify-webhook-signature`; only SUCCESS proceeds. Canonical order/capture amount, currency, IDs and internal custom ID must match. Unknown local orders request retry rather than discarding a potentially out-of-order paid event.

No raw card data is collected. No real vendor/runner payouts are issued. Ledger allocations explicitly show SIMULATED. Production PayPal is intentionally not configurable through a browser toggle.

Pending eCheck or review captures remain unpaid in the marketplace until canonical PayPal evidence confirms completion. **Check existing payment status** and the administrator's reconciliation control inspect the existing payment; they do not start a new checkout or duplicate a capture. A PayPal return URL, buyer receipt or seller hold notice alone is not completed-capture evidence.

Guarded full Sandbox refunds are implemented for eligible declined orders, restricted to the vendor owner or administrator. They require provider confirmation before local refund success is recorded. Simulated demo orders cannot use the provider refund route. Refund processing is a financial action, not a status check; do not use it to clear a pending test or demonstrate the UI without explicit authorization.

## Verification boundary

Three genuine marketplace Sandbox payments have already been verified, totaling **$44.00 USD**, with each matched to a PAID order, a completed signed webhook and exactly one customer-payment ledger entry. See [Sandbox verification](phase-4.3-sandbox-verification.md). The [current hardening report](hardening-2026-10-27.md) and [production metadata](evidence/hardening-production-2026-10-27.json) distinguish fresh read-only checks from that historical provider evidence; hardening did not initiate another genuine payment, refund or payout.

Local tests cover payment proof predicates, spoofed certificate hosts, invalid webhook headers, service-only confirmation, reconciliation and duplicate database processing. Local fixtures and private simulated orders do not prove a new provider capture. Any new genuine Sandbox transaction requires explicit operator authorization and buyer approval. Live payments, payment-dispute handling, actual payout APIs and scheduled payment reconciliation remain outside the current implementation; pending/paid orders must not be blindly cancelled or restocked.
