# Architecture

Local Town Runners uses Next.js App Router, React/TypeScript and Supabase Auth/PostgreSQL. Explore combines vendor storefronts, a compact product selection, a MapLibre map and Sidekick’s catalog-grounded assistant and errand planner. Vendor, runner and administrator work happens on authenticated server-rendered dashboards. Shareable profiles live under `/vendors/[id]`, `/runners/[id]` and `/listings/[id]`.

## Application boundaries

`src/lib/catalog.ts` supplies typed illustrative fixtures when Supabase is unconfigured. `src/lib/server/catalog.ts` reads configured catalog data with the current session/RLS and does not silently replace a configured database failure with fixtures. Discovery, availability and matching use public/coarsened data; private delivery addresses never enter the catalog.

Anonymous visitors can preview the public fictional template. Signed-in discovery uses the caller's exact marketplace scope: real accounts use the real marketplace, private demos use their own workspace, and administrator Explore does not mix in private QA workspaces. Runner profile scopes are private under RLS, so a server-only service lookup filters only the runner IDs already authorized by the caller's read, in batches of at most 100. It returns no additional profile fields to the browser or assistant. The existing service key is required for that scope check; unavailable checks fail explicitly rather than returning candidates from another workspace.

Server modules separate configuration, authentication, database access, request validation, onboarding, demo sessions, reputation, AI interpretation and PayPal. Route handlers validate Origin, strict bounded input, authenticated actor, account state and relevant rate limits. RLS, column grants and PostgreSQL RPCs independently enforce business permissions. React state controls presentation and local editing drafts, never authoritative roles, prices, inventory or payment state.

The existing assistant selects from a validated tool registry. Server tools return catalog-grounded facts and authorized order status. Its `prepareOrder` tool produces a reviewable quote only. Quick recognized phrases and the Neighborhood Connection preview can use catalog rules; they are not proof of a model interpreting a new request. Actual cart preparation, payment and fulfillment require explicit user actions through protected routes.

## Sidekick Errand Planner

`POST /api/assistant/plan` is a separate model-first planning path. The configured provider normally receives one bounded OpenAI-compatible Chat Completions request with a forced structured `buildLocalPlan` function proposal. If canonical server validation rejects that proposal, one corrective call may use fresh catalog facts and server-computed option totals as feedback. There are at most two model calls, each with a 20-second timeout and bounded response; HTTP, authentication and provider failures do not trigger a retry. The model has no application write tools. It can interpret quantities and constraints, compare up to three distinct combinations of one to four listings, revise a prior plan or ask one clarification. It proposes choices; it cannot execute a purchase.

The input contains at most 100 active, in-stock listings from the caller-visible catalog, plus the current request and at most six short recent turns. The private demo currently has 25 listings; a larger catalog is explicitly labeled as a bounded comparison rather than an exhaustive marketplace search. The supplied facts include public listing/vendor details, prices, stock and a coarse pickup snapshot. Operational addresses, account records, orders, credentials and precise runner locations are excluded from that context. The request text itself goes to the configured provider: users should keep private information out of it. Recent conversation is held in component memory and sent as bounded text/summaries, with no durable chat history added by this feature. Provider retention remains subject to the operator’s provider configuration and policy.

Before the model call, server loading applies authentication, the assistant rate limit, caller marketplace/workspace scope and blocked-vendor exclusions. After each model response, it reads scope, catalog, blocks, stock, runner workloads and trip windows again. Only IDs actually offered to the model remain eligible. The server resolves each proposal against those fresh facts, derives integer-cent line and whole-option totals, and rejects unavailable stock, duplicate item IDs, excessive quantities, over-budget combinations or violations of the selected locally-made/one-shop controls. A correction must pass these same checks; model agreement with feedback cannot override them. Each vendor’s option is limited to twenty units. Supported numeric budgets in the request and the explicit budget control constrain the whole option; an inferred model budget is identified for review.

Pickup compatibility and expiry come from server matching, not model assertions. A runner must be eligible for every selected category at that shop. A declared trip expires at the earlier of its trip or availability window, and the browser stops displaying it as current after expiry. The result remains a snapshot: acceptance is still required, with no route ETA or delivery guarantee. Food portions, ingredients and dietary suitability require vendor confirmation.

The returned provenance distinguishes a validated **AI-assisted plan** from **Catalog suggestions — AI unavailable**, and records whether a model plan required one or two attempts. Missing configuration, provider failure or a proposal still invalid after the bounded correction returns clearly labeled catalog suggestions; it does not present them as an AI-generated plan. Observability records stage/outcome metadata, not prompts, credentials or raw provider responses. See [the planner guide](sidekick-errand-planner.md) for operation and release verification.

**Review this option** opens a review with exact listing quantities. Only **Save these choices to cart** issues sequential upserts through the existing authenticated cart route. Each upsert sets the chosen quantity, making retries safe from duplicate units; this is not an atomic multi-item transaction. A failure reports how many saves were confirmed, and the user can inspect the cart or retry. Other items already in the cart are outside the plan subtotal. Existing database role/workspace/availability checks remain authoritative for writes. Saving reserves no stock and creates no order. Full-cart/address review and explicit **Prepare this vendor order** remain the boundary to the preparation RPC; payment and runner acceptance keep their existing separate controls.

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
