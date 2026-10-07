# Database

`001_marketplace.sql` creates profiles/multi-role memberships; vendors and private pickup data; listings; runner public approximation/temporary availability and trips; orders/private delivery data; append-only events; payment events; ledger; audit; reports; blocks; rate limits. `002_reviews.sql` adds completed-order reviews. Migrations 003–006 enforce bounded runner availability, blocked-account checks, controlled vendor/role provisioning, coordinate constraints and tighter pickup privacy. Migration 007 adds image metadata and a WebP-only public asset bucket with server-only write policies when Storage is present.

All application tables enable RLS. Client roles cannot directly write orders, payments, financial allocations, role memberships, moderation state, reliability or rewards. Column grants prevent mass assignment of protected properties. Security-definer RPCs use an empty search path, fully qualified relations, explicit authorization and restricted EXECUTE grants. `confirm_payment` is service-role only.

`prepare_order` locks inventory and serializes customer/request-key pairs. It derives prices from the listing and reserves quantity once. Reusing a request key returns the existing order. `cancel_draft` can restore inventory only before any PayPal order is attached. A pending or paid payment must be reconciled before cancellation; there is no unsafe automatic refund/restock path.

Payment processing locks the order and uses unique PayPal IDs and webhook event IDs. Capture/webhook retries do not duplicate ledger allocations. Ledger records use bigint integer cents. Allocations are 80% vendor, 15% runner, remainder platform, preserving every cent. Only the Sandbox customer payment is marked nonsimulated; allocation disbursements are simulated. Completed orders increment runner rewards once.

Order transitions require the vendor owner, assigned runner or customer according to the next action. An admin does not gain a generic state-jump bypass. Runner assignment requires an active runner, valid availability, category compatibility and workload below three. Proximity scoring is advisory, not a substitute for those checks.

Public coordinates are rounded in database triggers. Private pickup and delivery addresses are separate relations. An assigned runner's address access expires when fulfillment ends. Customer addresses are not readable by vendors or admin through normal UI grants.

## Operational gaps

Pending-payment expiry/refunds need PayPal reconciliation before stock release. Rate-limit rows currently require scheduled retention cleanup in production. Audit/event data needs a retention policy. A production migration must be tested against the selected project's Auth/storage schema before applying. PGlite tests run migration/RLS semantics; the hosted project remains a separate integration boundary.
