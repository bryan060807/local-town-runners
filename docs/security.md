# Security controls and limits

This document describes the current Sandbox/demo application. It is not a claim of commercial certification or an independent penetration test. See the [threat model](threat-model.md), [database invariants](database.md) and [deployment operations](deployment.md).

## Identity and authorization

Server Auth calls `getUser()` to validate the token with Supabase; it does not accept a browser-selected role as authority. The request proxy propagates refreshed cookies with `getAll`/`setAll`. Real account ordering requires confirmed email and current customer consent. Vendor, runner and administrator privileges require approved server-controlled membership; pending and rejected roles do not authorize their dashboards or actions. Suspension and deletion-request restrictions are enforced independently of presentation.

Cookie-authenticated writes require the configured exact `Origin`, bounded input and strict schemas. Database RLS, column grants and actor-specific RPC checks apply even if callers bypass Next routes. Service-only operations separately validate their caller and resource association. Supabase Auth controls and database-backed entry/action limits bound abuse; limits can return 429 and must not be bypassed by resetting hosted records.

Private Demo Mode uses a hashed, expiring ticket and three distinct fictional identities in one workspace. Simulation checks the active ticket, actor, roles, profiles and workspace. Role switching is a presentation convenience within that workspace, not real role assignment. Missing, expired, cross-workspace or real-account simulation attempts are denied. Exiting a session does not delete retained evidence.

## Payments and simulation

PayPal calls stay server-side and use fixed Sandbox endpoints. Canonical merchant capture status, amount, currency, internal custom ID and PayPal order association must match before payment confirmation. A parent order marked COMPLETED, a browser redirect or a pending capture is insufficient. Capture attempts and unique provider identifiers prevent repeat capture/ledger credit; reconciliation can check an existing payment without creating a new charge.

Webhooks require PayPal signature verification and canonical association checks before completed payment credit. Certificate URLs are limited to PayPal HTTPS hosts. Missing signature headers fail before provider requests; body size is bounded. Webhooks are exempt from the browser Origin check because the provider is the sender. Their verification boundary is independent.

Simulated orders have immutable `demo_simulated` provenance, a timestamp and a separate `DEMO_PAYMENT` ledger kind. Their PayPal IDs remain empty, every ledger row is simulated and actual payouts remain zero. Genuine checkout durably claims its draft before any provider request; that draft cannot later be converted into a simulation. Provider payment/capture/status/refund/recovery paths reject simulated orders. Unassigned simulation cancellation restores fictional stock once and never creates a refund. Row locks and evidence guards serialize competing payment paths.

## Data, uploads and AI

Public coordinates are coarsened. Pickup/delivery addresses live in separate protected relations; active assigned runners receive only the operational access needed by fulfillment. Public catalog data, model input and log events do not contain private delivery addresses. A runner may retain information they legitimately saw, so technical expiry still requires an operational privacy policy.

React escapes descriptions and assistant text; no arbitrary user HTML is injected. CSP prevents framing and constrains resources/workers. Production hydration still permits inline scripts; a nonce-based strict CSP remains future hardening. Uploaded PNG/JPEG/WebP files have bounded bytes/pixels, require successful raster decoding, are resized and have EXIF/GPS stripped. Ownership is checked before server-only Storage writes. Private onboarding PDFs/photos require owner or real administrator authorization and short-lived signed downloads; immutable originals are preserved. Hosted private Storage access was verified separately from the reduced local stack, which has no Storage service.

The assistant may choose only validated catalog tools and authorized order reads. It cannot submit arbitrary SQL, select roles, confirm financial state or invoke protected writes. Prices, inventory and returned IDs are grounded in catalog rows. An AI order preparation response is a quote for explicit review, not a reservation or completed purchase. Without a provider key, labeled deterministic discovery remains available.

Signed-in vendor/item reads and runner recommendations use the caller's exact marketplace scope. A narrowly constrained service lookup reads only scope membership for runner IDs already visible under caller RLS; it cannot broaden the returned roster. Missing service configuration fails closed. Anonymous template previews remain available, while direct cross-workspace cart/order attempts remain blocked by PostgreSQL regardless of UI filtering.

## Consent, notifications and secrets

Agreement versions, accepted submissions, signatures and successful PDF evidence are immutable. Corrected presentation copies do not overwrite originals. Electronic signature evidence is not a certified cryptographic digital signature. Administrative review, notification attempts and state decisions retain audit history.

Resend notification claims serialize retries and use stable idempotency keys. Provider acceptance requires a receipt and remains distinct from inbox delivery. Uncertain deliveries near the provider deduplication limit are blocked for operator review rather than blindly resent. The Cron worker requires its bearer secret; delivery events require a separate timestamped signature. Auth verification/recovery mail has separate Supabase configuration.

Secrets stay in server-only modules and secure deployment settings. Logs expose constant stages, error classes, SQLSTATE and safe status codes, never request bodies, tokens, exact addresses, signatures or provider payloads. Service credentials have broad authority and support private demos, sanitized uploads, onboarding and payment administration; restrict and rotate operational access. Never commit `.env` files or raw authenticated traces.

## Remaining operational work

The application has regression and hosted integration evidence, not comprehensive load, recovery or adversarial assurance. Before commercial use, complete independent security review, restore drills, retention/deletion procedures, abuse/availability monitoring, operational ownership and appropriate vendor/runner verification. Road feasibility, real payouts and commercial agreement approval remain outside the current product boundary. Keep genuine Sandbox evidence distinct from simulated demonstrations.
