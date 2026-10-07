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
