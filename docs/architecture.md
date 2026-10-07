# Architecture

The customer surface combines a MapLibre world layer, a compact assistant and contextual catalog cards. Vendor/runner/admin work happens on authenticated server-rendered dashboards. Public shareable profiles live under `/vendors`, `/runners` and `/listings`.

`src/lib/catalog.ts` supplies typed, offline demo fixtures. `src/lib/server/catalog.ts` reads configured Supabase public data and never silently falls back after a configured database failure. `src/lib/runners.ts` implements testable, deterministic matching. `src/lib/orders.ts` defines state and money invariants; PostgreSQL independently enforces transitions.

Server modules separate environment validation, authentication, database access, request validation, AI interpretation and PayPal. Route modules separate auth, preparation, orders, payment checkout, capture, webhooks, fulfillment, vendor changes, runner changes, moderation, blocks, reviews and reporting. Database events and ledger entries provide durable business evidence. React state controls presentation only.

## Data flow

1. Public catalog reads use the public Supabase key and RLS.
2. Protected actions validate Origin, strict Zod input, authenticated user, account suspension and rate limit.
3. Atomic PostgreSQL RPCs reserve stock, mutate protected states and append events.
4. PayPal is called only server-side. Completed capture, amount, currency, PayPal order ID and internal custom ID are checked before a service-only payment RPC.
5. Verified webhooks re-fetch canonical PayPal order data, then use the same idempotent RPC.
6. Ledger allocations and rewards are database-backed; payouts remain simulated.

## Deliberate limits

MVP matching uses coarsened coordinates and straight-line proximity. It does not supply road travel times or precise delivery detours. Existing trips receive an explicit score preference. Real-time subscriptions, advanced routing, multi-item carts, external reward partners and real payouts are not implemented. Read/write workflows remain usable without those optional services. A delivery address is required for connected checkout and stays in a separate RLS-protected table. Make/Do listings reserve capacity and require final scope agreement; the seed descriptions clearly communicate consultation/custom lead times.

Raster uploads are validated, resized and stripped of metadata server-side before service-only Storage writes. Hosted Storage remains unverified; the reduced local backend does not include Storage.
