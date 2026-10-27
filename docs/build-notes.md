# Current implementation and validation guide

The current application is deployed at **https://runners.aibrylabs.com**. It includes vendor-focused Explore, compact vendor catalog management, grounded assistant tools, persistent vendor-grouped carts, private three-role demos, state-gated fulfillment, real account onboarding/private consent documents, notification retries, reputation and guarded PayPal Sandbox processing. The [README](../README.md) is the feature/setup entry point; [architecture](architecture.md) explains boundaries and [deployment](deployment.md) covers operations.

## Evidence by boundary

| Boundary                         | Recorded evidence                                                                                                                                                                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Genuine PayPal Sandbox           | Three captures totaling $44.00, three PAID orders, authentic completed webhook records, exactly one customer-payment entry each and idempotent reconciliation; [payment report](phase-4.3-sandbox-verification.md)                                                                                                              |
| Private simulated workflow       | Actual simulation button through Customer/Vendor/Runner completion/review, four simulated ledger rows, no PayPal IDs or payouts, replay guards and unchanged preserved financial records; [walkthrough and validation](demo-order-walkthrough.md), [hosted evidence](evidence/demo-order-simulation-production-2026-10-27.json) |
| Explore and recognition          | Vendor/storefront directory, paginated items, mobile rail, honest new-vendor states and private recognition; [rules and release evidence](community-recognition.md)                                                                                                                                                             |
| Persistent application workflows | Real local PostgreSQL/Auth/PostgREST plus desktop/360/390/430px browser coverage; [acceptance report](demo-acceptance-2026-10-26.md) and subsequent feature reports                                                                                                                                                             |
| Onboarding and delivery          | Versioned immutable consent/private PDFs, hosted private Storage authorization probe, durable Resend receipt/retry and operator-confirmed inbox receipt; [onboarding tests](phase-4-test-report.md), [notification production results](phase-4.1-production-results.md)                                                         |

The simulation release recorded **93 unit/database tests and 52 connected browser checks** on October 27, 2026. Those are dated release results, not an automatic assertion about every later commit. Run the repository checks for the revision under review; new hardening results belong in their own report. Historical reports retain earlier unconfigured/pending states for traceability.

## Reproducible validation

Run `npm run check` (formatting, lint, type checking and unit/database tests), then `npm run build`. `npm run test:e2e` manages an isolated offline production server. For persistent Auth/order/role acceptance, start the [local backend](local-backend.md) and gateway, run the local template/agreement seeds, then `npm run test:e2e:local`. Port 3000 must be free. The connected suite uses desktop and 360/390/430px viewports; keep UI and source unchanged while a final suite is running.

Local wrappers remove hosted PayPal, Resend and AI credentials. Local payment fixtures and explicit simulated orders do not establish a new Sandbox capture. Browser recordings, screenshots and JSON intended for sharing must be sanitized; do not commit authenticated traces or private application documents. Optional hosted smoke tests must respect session limits and preserve existing legal/financial evidence.

Fonts and the map worker are self-hosted. Map tiles use a bounded fixed-host HTTPS route with system trust and caching. The reduced local stack excludes Storage, SMTP and Realtime. Configuration presence, a passing build, an unsigned webhook attempt or a quiet log stream is not proof of a successful remote integration.

## Readiness limits

The hackathon path can demonstrate the full order lifecycle without another financial transaction, while genuine Sandbox evidence remains independently inspectable. Live payments, real payouts, commercial vendor approval, paid placements/subscriptions, road-routing guarantees and cash-value rewards are not enabled.

Further rollout needs monitored availability and notification backlog, abuse/capacity testing, backup/restore drills, explicit retention/deletion procedures, appropriate tile capacity, commercial policy/verification review and independent security assurance. Do not reset hosted data or change provider credentials merely to rehearse. Test in one fresh private demo session and keep actual operator work outside Demo Mode.
