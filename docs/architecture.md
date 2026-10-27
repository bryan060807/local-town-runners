# Architecture

Local Town Runners uses Next.js App Router, React/TypeScript and Supabase Auth/PostgreSQL. Explore combines vendor storefronts, a compact product selection, a MapLibre map and a catalog-grounded assistant. Vendor, runner and administrator work happens on authenticated server-rendered dashboards. Shareable profiles live under `/vendors/[id]`, `/runners/[id]` and `/listings/[id]`.

## Application boundaries

`src/lib/catalog.ts` supplies typed illustrative fixtures when Supabase is unconfigured. `src/lib/server/catalog.ts` reads configured catalog data with the current session/RLS and does not silently replace a configured database failure with fixtures. Discovery, availability and matching use public/coarsened data; private delivery addresses never enter the catalog.

Server modules separate configuration, authentication, database access, request validation, onboarding, demo sessions, reputation, AI interpretation and PayPal. Route handlers validate Origin, strict bounded input, authenticated actor, account state and relevant rate limits. RLS, column grants and PostgreSQL RPCs independently enforce business permissions. React state controls presentation and local editing drafts, never authoritative roles, prices, inventory or payment state.

The assistant selects from a validated tool registry. Server tools return catalog-grounded facts and authorized order status. Order preparation by the assistant produces a reviewable quote only. Actual cart preparation, payment and fulfillment require explicit user actions through protected routes.

## Order and money flow

1. A customer groups cart items by vendor and supplies an authorized delivery address.
2. A PostgreSQL preparation RPC derives current prices, reserves stock atomically and returns the same order for a repeated request key.
3. A private demo draft may use explicit simulated payment, or an eligible customer may start genuine PayPal Sandbox checkout. Genuine checkout durably claims the draft before provider access; the sources cannot be mixed later.
4. The simulation RPC validates the active private ticket/workspace and records immutable provenance plus four simulated ledger rows, with no PayPal IDs or requests.
5. Genuine payment confirmation requires canonical merchant capture `COMPLETED`, matching amount/currency/custom ID and order association. Signed webhooks and guarded reconciliation share idempotent database confirmation. A pending capture remains pending.
6. Vendor acceptance, runner matching/assignment, readiness, pickup, delivery and customer completion use actor/state-gated transitions. Rewards update once. Allocations remain simulated even for genuine Sandbox captures; no payout API is implemented.

`src/lib/orders.ts` and payment validation helpers expose testable invariants; PostgreSQL independently enforces transitions, locks and uniqueness. Durable order events, payment events, recovery observations, ledger records and audit events provide distinct evidence. A provider receipt or parent order status does not replace completed capture proof.

## Demo and reputation

Each visitor gets a six-hour private demo workspace with fictional customer/vendor/runner identities, cloned catalog and stock. Switching profiles keeps the workspace; exiting and re-entering starts a fresh one. Old financial history is preserved and remains available through authorized administration, not copied into the next visitor's account.

Vendor ratings derive from eligible completed purchases and unique reviews. Public aggregates exclude customer identities and review text. Private customer recognition derives from recorded activity and has no cash value. Explicit simulation evidence contributes only within the authenticated private demo workspace; public/template and genuine reputation stay separate. See [recognition rules](community-recognition.md).

## Account intake and background work

Real users confirm email and accept versioned customer Terms/Privacy before ordering. Vendor/runner applications preserve submitted information, consent and private document evidence. Real administrator approval grants only the reviewed participation role. Private document access requires an owning applicant or administrator and expires quickly.

Notification jobs persist independently of request success. Resend claims, stable idempotency keys, receipts and bounded retries distinguish accepted, failed, blocked and delivered states. A daily authenticated Vercel Cron worker processes a small batch; manual-only historical work remains manual. No persistent app server or writable durable application disk is required.

## Deliberate limits

Matching uses coarsened coordinates and straight-line proximity, not road travel time or guaranteed delivery feasibility. Availability/trips expire; the runner may need to renew them during a rehearsal. Real-time subscriptions, advanced routing, real payouts, subscription billing, sponsored placements and external reward redemption are not implemented.

The reduced local backend provides real PostgreSQL/Auth/PostgREST and excludes Storage, SMTP, Realtime and hosted payment services. Hosted integration proof is recorded separately. The product is a fictional/Sandbox demonstration; commercial launch needs operational, legal, privacy, verification and provider readiness beyond passing local tests.
