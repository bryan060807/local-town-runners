# PayPal Sandbox

Official PayPal developer pages returned HTTP 403 in this environment. The current official PayPal OpenAPI sources were fetched and read before integration:

- https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/checkout_orders_v2.json
- https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/notifications_webhooks_v1.json

OAuth uses server-only Basic authentication against `/v1/oauth2/token`. Orders v2 uses `intent: CAPTURE`, a USD purchase-unit amount derived from the database, internal order `custom_id`, and PayPal experience-context approval URLs. `PayPal-Request-Id` keys derive from the persisted order ID for create/capture retries.

## Configure

1. Create a PayPal Sandbox REST app and merchant/buyer test accounts.
2. Store client ID, client secret, webhook ID and trusted `APP_URL` securely.
3. Register the externally reachable HTTPS `/api/webhooks/paypal` endpoint for `PAYMENT.CAPTURE.COMPLETED`.
4. Use a configured Supabase project and server service credential; apply migrations and seed the demo.
5. Customer prepares an order, then explicitly chooses PayPal Sandbox on the dashboard. The server returns a PayPal approval URL.
6. After buyer approval, choose “Confirm approved payment”. A browser return URL alone never marks the order paid. Capture and/or the verified webhook confirm the canonical payment.

Webhook verification submits PayPal transmission headers, registered webhook ID and original event to `/v1/notifications/verify-webhook-signature`; only SUCCESS proceeds. Canonical order/capture amount, currency, IDs and internal custom ID must match. Unknown local orders request retry rather than discarding a potentially out-of-order paid event.

No raw card data is collected. No real vendor/runner payouts are issued. Ledger allocations explicitly show SIMULATED. Production PayPal is intentionally not configurable through a browser toggle.

## Verification boundary

Local tests cover payment proof predicates, spoofed certificate hosts, invalid webhook headers, service-only confirmation and duplicate database processing. A successful real Sandbox capture and registered signature verification remain required before calling the live flow verified. Refund processing, payment disputes, payout APIs and reconciliation automation are future work; pending/paid orders must not be blindly cancelled or restocked.
