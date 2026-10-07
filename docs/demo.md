# Demonstration

## Offline discovery

Open the app. The header clearly says offline demo catalog. Ask “I'm hungry. What's good?” and inspect Habanero Cinnamon Rolls. Quantity two previews $9.00. Preview does not reserve stock or process a payment. Ask for a birthday gift under $40; actual catalog gift cards and map highlights appear. All vendor names are fictional demo businesses.

## Connected signature flow

Apply migrations, configure Supabase/PayPal and run the seed. Sign in as `customer@local-town-runners.example`, using the securely supplied `DEMO_SEED_PASSWORD`. Each role has its corresponding reserved email: customer, vendor, runner, admin. Additional seeded runner accounts are `runner-sarah@local-town-runners.example` and `runner-jordan@local-town-runners.example`.

1. Browse the demo bakery, choose two rolls and enter a private delivery address.
2. Prepare the order, then explicitly approve a PayPal Sandbox checkout on the dashboard.
3. Complete Sandbox approval; use the confirm button after returning. Verify PAID and a single customer payment/three simulated ledger allocations.
4. Sign in as vendor. Accept → begin matching.
5. Sign in as runner. Set availability and the bakery trip, then accept the available run.
6. Vendor marks ready. Runner confirms pickup → out for delivery → delivered.
7. Customer completes. Inspect runner rewards, inventory, order events and admin payment/audit records.

Never claim the connected scenario passed without the external Sandbox evidence. No shortcut bypasses payment confirmation in the public app.

## Restore/reset

`npm run seed` re-establishes the known demo catalog and renews illustrative runner availability. It preserves existing orders, inventory counters and financial/audit events. Repeat seeding updates descriptions and availability but does not restock existing listings. Use a dedicated disposable Supabase demo project.

A full fresh demonstration database can be restored using `supabase db reset` **only for the local development stack**, then rerun the seed. This drops local development data. Do not use a destructive remote reset against shared/production data. No remote reset command is included. Fixture-backed tests create isolated in-memory PostgreSQL instances and close them after every case.

The tested reduced PostgreSQL/Auth/PostgREST backend uses different reset commands from the full CLI stack; see [local backend setup](local-backend.md).

## Phase 2 repeatable local demo

Use the dedicated local stack, not hosted Production data. Keep `npm run local:gateway` running. Stop the application process and run:

```sh
npm run local:reset -- --confirm-demo-reset
npm run local:dev
```

Reset validates loopback configuration and exact named container images, deletes only `ltr-local-rest`, `ltr-local-auth`, `ltr-local-db` with their anonymous volumes, then rebuilds all migrations and seeds. It restores six known `.example` role accounts, 15 explicitly demo vendors/listings, cinnamon rolls stock 12, empty orders/events/ledger, zero rewards, and a fresh one-hour Bryan trip to the bakery. Generated passwords stay in restricted ignored `.local-backend/` files. Existing hosted credentials cannot override the local wrapper. Local reset never marks an unpaid order paid or bypasses Auth/RLS; Sandbox checkout needs separate hosted configuration and buyer approval.

Signature: hungry → “Wait. Habanero cinnamon rolls?” → “Get me two” → review current $9 quote and already-heading candidate → explicit preparation. Without payment credentials the payment button fails clearly; it never simulates success. In the configured Sandbox deployment continue using the operator flow in paypal-verification.md.

Gift demo: “A birthday gift for my wife around $40” → “Which one is actually made here?” → “Show me that one” → “Who could bring it?” Availability tools explain candidates and approximate approach, never promise arrival tonight or a precise road detour.
