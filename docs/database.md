# Database and invariants

A fresh installation applies all files in [supabase/migrations](../supabase/migrations) in order. The existing hosted project has migrations through **016**; preserve its orders, consent and ledger evidence. Operator upgrade SQL in [docs/sql](sql) documents specific additive paths. Do not rerun initial setup or reset the hosted database as a deployment step.

## Migration map

| Migration | Purpose                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 001       | Profiles/multi-role memberships, vendor catalog, private pickup/delivery data, expiring runner availability/trips, orders, events, payment/ledger/audit, reports, blocks and action limits |
| 002       | Completed-order reviews                                                                                                                                                                    |
| 003–006   | Runner eligibility, blocked-account checks, controlled vendor/role provisioning, coordinate constraints and private address access                                                         |
| 007       | Sanitized image metadata and server-only public-asset bucket writes when Storage exists                                                                                                    |
| 008–009   | Service-only verified payment attachment/readiness, runner approach guards and public vendor references                                                                                    |
| 010–011   | Isolated demo workspaces, persistent vendor-grouped carts/inquiries and guarded Sandbox refund records                                                                                     |
| 012       | Real account/email/consent gates, immutable agreements, private onboarding evidence, review decisions and retention-aware deletion requests                                                |
| 013       | Durable notification retry/receipt metadata, separate immutable readable document presentations and delivery-event state                                                                   |
| 014       | Payment recovery observations, durable capture safeguards and reconciliation                                                                                                               |
| 015       | Read-only vendor reputation/private recognition aggregates and supporting indexes                                                                                                          |
| 016       | Explicit isolated order simulations, durable genuine-checkout intent and financial-source guards                                                                                           |

## Access and state

Application tables use RLS. Client roles cannot directly assign memberships, mutate protected order/payment state, manufacture allocations or set reliability/rewards. Column grants prevent mass assignment. Security-definer RPCs use an empty search path, qualified relations, explicit actor checks and restricted EXECUTE grants. Payment confirmation and simulation are service-only entry points with separate authority/evidence checks.

Order transitions require the vendor owner, assigned runner or customer appropriate to the next action. Administrator access does not provide a generic state-jump bypass. Runner assignment requires an active eligible runner, valid availability/category compatibility and workload below three. Matching scores are advisory, not substitutes for authorization or capacity checks.

Public coordinates are rounded by triggers. Private pickup/delivery addresses live separately; active assigned-runner access ends with fulfillment. Normal vendor/admin grants do not expose customer delivery addresses.

## Inventory and idempotency

Preparation derives prices from current listings, locks inventory and serializes customer/request-key pairs. Cart preparation preserves item snapshots, reserves quantities once and groups a single order by vendor. Request replay returns its prior order. Untouched drafts can be canceled under their guards; provider-associated pending payments cannot be restocked as if no financial attempt existed.

Payment confirmation locks the order and uses unique provider/webhook identifiers. Reconciliation and webhook retries do not duplicate customer payment or allocations. Ledger money uses integer cents. Allocations are 80% vendor, 15% runner and the remainder platform, preserving every cent. Only a genuine captured Sandbox `CUSTOMER_PAYMENT` is nonsimulated; allocation disbursements remain simulated. Completion updates runner counters/rewards once.

Refund processing has explicit state/association checks and separate recorded provider evidence. Pending-payment recovery checks existing capture status before considering further financial action. There is no generic timer that silently cancels/refunds pending provider transactions or releases their stock.

## Simulation separation

`orders.demo_simulated` and `demo_simulated_at` provide immutable, consistent source provenance. `simulate_demo_payment` requires the active ticket hash, customer identity and same private workspace, and accepts only an untouched draft with no financial evidence. It records one `DEMO_PAYMENT` and three allocation rows, all simulated, with empty PayPal order/capture/refund IDs.

A genuine checkout first inserts into `paypal_checkout_intents` under the order lock. Simulation then rejects that draft even if provider access later fails. Evidence guards serialize inserts against simulation and prevent reparenting evidence to another order. Genuine capture/recovery/refund paths cannot attach payment records to a simulated order.

Before runner assignment, an authorized private demo vendor can cancel eligible simulated states. Cancellation restores item stock once, retains simulated ledger history and records no provider refund. Assigned fulfillment must follow its state machine. Repeated simulation requests are idempotent; repeated completion is rejected without awarding again.

Reputation derives from eligible captured/completed orders and unique reviews. Simulated completions contribute only to the current private demo workspace through explicit simulation evidence. No positive ratings are seeded into public reputation.

## Operations and validation

PGlite tests execute migration/RLS behavior with actual nonprivileged roles. The reduced local stack exercises real PostgreSQL, GoTrue and PostgREST; Storage and hosted providers require separate evidence. Fresh-install and existing-upgrade behavior must both be reviewed when adding a migration.

Expiry limits demo/trip access but does not erase records. Rate-limit/demo operational records, addresses, audit history and immutable legal/financial evidence need a documented retention policy. Account deletion currently creates a restricted, retention-aware request; it is not an automatic purge of legally retained evidence. Maintain backups and test restoration before wider operation. Never use resets, ownership changes or deleted ledger records to make a demonstration look successful.
