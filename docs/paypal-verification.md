# PayPal verification

October 7, 2026. This document records observed behavior, not assumed readiness.

## Actual external checks

The configured Sandbox Client ID/secret authenticated at `https://api-m.sandbox.paypal.com/v1/oauth2/token`: HTTP 200 and an access token was returned. No token or credentials were logged. The hosted catalog public read returned zero listings, and no Sandbox buyer approval was available during this audit. Therefore application order creation, approval, capture, authentic registered webhook delivery and completed hosted fulfillment are **not verified end-to-end**. Earlier user-supplied simulator logs showed delivery to the endpoint but OAuth failed then; current OAuth success does not prove those simulator events processed successfully.

A simulator posts sample events; it does not buy a real listing or create a persisted application order. Authenticity remains mandatory. A verified capture event referring to an absent application order receives 503 for retry; no missing order is invented. This is intentional and distinguishable from an OAuth failure using safe structured logs.

## Tested processing and authorization

- Amount/quantity derived in locked database preparation; browser prices rejected.
- Server-only payment attachment; clients cannot bind arbitrary PayPal IDs. Ownership/custom ID checked **before** capture as well as afterward.
- Checkout preflight checks service database and Phase 2 migration readiness before creating a PayPal order.
- Repeated checkout uses persisted PayPal ID and stable request ID. Approval URL alone never confirms payment.
- Capture retries read canonical completion before recapturing, then verify USD amount, order/custom ID and capture status.
- Webhook verification uses PayPal's signature API and configured webhook ID. Untrusted certificate hosts rejected; body bounded.
- Tests exercise invalid signatures, canonical mismatch, missing application orders, duplicate delivery, service-only financial RPC, four ledger rows and exactly-once rewards. Database tests inject service-side payment proof as a test fixture; this is not a payment or an application bypass.
- Allocations: 80% vendor, 15% runner, cent remainder platform. Vendor/runner disbursements remain SIMULATED; no payout occurs.

## Operator checklist for a real Sandbox demo

Apply migrations 008 and 009 before deploying Phase 2. Set Production APP_URL to `https://runners.aibrylabs.com`; Client ID/secret/webhook ID must belong to the same Sandbox app. Register `https://runners.aibrylabs.com/api/webhooks/paypal` for PAYMENT.CAPTURE.COMPLETED. Seed approved demo records with securely generated account credentials, or import approved vendor records; set private pickup information separately.

Sign in as customer, discover cinnamon rolls, review two at $9, provide delivery address, explicitly prepare/reserve, approve Sandbox checkout as a separate Sandbox buyer, then confirm capture. Observe PAID only after canonical verification. Vendor accepts and opens runner matching; runner accepts, vendor marks ready, runner picks up and marks out for delivery/delivered, customer confirms completion. Check stock, ledger, history and rewards in database/dashboard; replay the same authentic event and confirm no duplicates. Record actual IDs privately and redact logs before sharing.

Safe log events expose stage/status only (oauth, capture, order, webhook_verification, missing_order, payment_mismatch), never credentials/provider bodies/private addresses. Refunds, disputes, pending-payment reconciliation and real payouts remain Phase 3 work.
