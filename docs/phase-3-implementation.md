# Phase 3 implementation

Phase 3 extends the existing Next.js/Supabase marketplace and PayPal Sandbox checkout. All new accounts, shops, products, pickup points and delivery addresses are fictional. No prospective real vendors were imported.

## Database and deployment

Apply migrations `010_phase3_demo_marketplace.sql` and `011_phase3_refunds.sql` after Phase 2. For the hosted SQL Editor, use `docs/sql/phase-3-upgrade.sql` once: it combines both migrations into one atomic transaction. `select public.phase3_ready();` returns true after application. Normal profiles, orders, captures and ledgers are preserved.

With existing Supabase settings securely injected, run `npm run seed:phase3`. It creates the public fictional template only when absent and enables Demo Mode. Repeated runs preserve stock, orders and external transaction history. The template contains four shops and 25 listings; Riverbend has ten. SELL listings have actual persisted stock and prices; MAKE/DO use persisted quote inquiries.

Phase 3 was released to `main` on October 8, 2026, after the user applied the hosted upgrade and `npm run seed:phase3` / `npm run verify:phase3` passed. Vercel serves the updated app; live authenticated demo role switching, cart access and sign-out were verified. For future installations, apply the upgrade and run these seed/verification commands before releasing schema-dependent application code. Keep `APP_URL=https://runners.aibrylabs.com`. No new mandatory secret is required. `DEMO_MODE_ENABLED=false` prevents new entry/switching; to revoke existing demo sessions at the database boundary, also run `update public.demo_settings set enabled=false where id=true;`. Re-enable using the seed command or the equivalent SQL update. Ordinary accounts remain functional.

## Isolated identity switching

Each visitor gets a six-hour workspace with genuine Supabase customer, vendor and runner Auth accounts. The primary identities are Alex Carter, Riverbend Market & Goods and Jordan Ellis. Secondary fictional stores belong to that workspace's vendor account. An opaque, HttpOnly, SameSite cookie points to a service-only session; account credentials are encrypted with AES-256-GCM and never sent to the browser. Exiting demo expires its switching ticket and checks successful Auth sign-out. Switch requests accept only three role names, and the server verifies the stored account/workspace before authenticating it. No normal user ID or arbitrary role is accepted.

RLS restricts demo catalog visibility and order operations to that workspace. Ordinary visitors see the public template; normal accounts cannot buy template items or access visitor demo data. Workspace expiry, suspension and database disablement stop protected demo operations. New shops created by demo vendors automatically inherit their workspace. Public runner coordinates retain Phase 2 rounding. Cookie-authenticated public profile routes honor workspace visibility. Catalog queries narrow listings/trips to visible vendor IDs, and dashboard history is narrowed to visible order IDs with independent reads batched; unrelated visitors remain protected by RLS.

## Marketplace state

Cart rows are customer-owned. Checkout groups by vendor: each vendor basket becomes one existing order with immutable line-item snapshots. Database locks serialize cart preparation and stock updates; retry keys reserve stock once. Canceling an unbound draft restores all lines once. Different vendors require separate approvals. Vendor price changes appear on the next catalog/cart refresh and new checkout; already-prepared orders retain their snapshot.

Customer preferences persist fictional addresses and notes. Order events and quote responses supply dashboard notifications. Fulfillment remains the existing state machine: verified payment, vendor acceptance, matching, assignment, ready, pickup, out for delivery, delivered and customer completion. Runner availability, transportation, approach limit, current trip and order history are persisted. Declining an offer hides it for that runner without canceling the customer order. Available offers respect workspace, expiry, every item category, pickup approach and workload; acceptance checks these again.

## Money and refunds

Customer checkout uses server-created PayPal Sandbox orders and verified capture evidence. Vendor and runner allocations are internal 80%/15% allocations; the platform receives the cent remainder. They are visibly labeled simulated, and actual payouts remain zero. No recipient account connection or transfer is claimed.

A vendor owner or administrator can decline an eligible paid, unassigned order through the Sandbox refund API. The order is marked refund-pending before the provider call; fulfillment and assignment are blocked during reconciliation. Only a completed USD refund for the exact total cancels the order, restores every stock line and appends a negative refund ledger entry. Stable provider request IDs and database guards prevent duplicate effects. A failed/pending provider result remains pending and requires retry/reconciliation; it never becomes fictitious success.

## Reusable local development

```sh
npm run local:backend
npm run local:gateway # keep alive in a separate terminal
npm run local:seed
npm run local:seed:phase3
npm run local:dev
```

Use wrappers: they override hosted environment settings and clear live provider credentials. The reduced local stack excludes Storage/Realtime; uploads are not claimed locally verified. The storefront has a bundled, labeled fictional illustration.

Developer-only reset: `npm run reset:phase3 -- --expire-demo-sessions` with securely configured service credentials. It expires visitor workspaces and their tickets. Exit and enter again to obtain fresh accounts, catalog, stock, trip and empty balances. Historical orders, PayPal IDs, ledgers and normal users remain untouched. This is separate from the dedicated local-container reset.

Known limits: six-hour workspaces cannot support indefinite delivery sessions; anonymous workspace creation is rate-limited to five per source/hour and incurs Auth/storage usage. Schedule retention review before public production traffic. Historical financial records are deliberately not automatically deleted. Rotating the service key invalidates encrypted switch credentials; expire visitor sessions as part of rotation. Real vendor onboarding and actual payout accounts remain future work.
