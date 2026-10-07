# Phase 2 report

October 7, 2026. Status: audited and hardened locally; hosted end-to-end payment/demo readiness is pending. This product is not production-ready. Coherent changes are committed for review; hosted migrations and deployment have not been performed by this audit.

## Audited

Repository routes/components, Supabase schema/RLS/grants, Auth getUser/cookies, atomic stock and order transitions, financial proof/idempotency, uploads, location boundaries, AI tool dispatch and model configuration, runner matching/trips, imports, demo reset, mobile/desktop UI, logs and external service availability. Live HTTPS and public REST reads were checked. The hosted account audit found one account with its profile present and no demo accounts; no personal identifiers were recorded. Automated local browser sessions cover customer, vendor, runner and admin dashboards; public sessions cover discovery, map, profiles, forms and previews. Hosted privileged role sessions were not invented or assumed.

## Main repairs

- Critical payment boundary: browser payment-ID attachment revoked; verified binding is server-only. Canonical internal association, amount and currency checked before capture. Completed retries do not recapture. Checkout preflights migration/service availability; financial confirmation remains service-only.
- Structured payment/webhook/AI/database/authorization/transition logs expose allowlisted stages/statuses/codes without secrets or private locations. OAuth/network failures can now be distinguished from absent local orders and invalid signatures.
- Grounded conversational discovery resolves selected/prior results against fresh rows. Added listing details, Made Local filtering, quantity review and deterministic follow-ups for cinnamon/gift demos; no charge or reservation from a model tool. Quotes include actual compatible candidates and explicit acceptance requirements.
- AI and map share vendor highlights, selected-vendor focus and suggested runner highlight. Approximate geolocation stays browser-local; dashed lines indicate declared intentions, not road routes.
- Matching explains expiry/category/workload/reliability/proximity/trip preference. Database acceptance enforces visibility, eligibility and coarse approach limit. Trip replacement expires old active intentions.
- Stable order request keys and disabled preparation during a request prevent retry stock duplication. Anonymous visitors can use public deterministic discovery; provider calls/personal tools require auth.
- Local scripts now override inherited hosted variables rather than relying on --env-file precedence. Confirmed local reset deletes only dedicated named demo containers, rebuilds all migrations and restores known stock/accounts/trips/orders/rewards. No runtime security bypass introduced.
- Approved vendor import adds public business description/hours/HTTPS references/asset photos and availability. Whole-batch preflight prevents ownership transfer or listing reassignment; imports emit audit records. Real businesses require approval references; no scraping/fabrication.
- Mobile touch targets and form sizing improved; role dashboards/profile/modals tested at desktop, 360×800, 390×844 and 430×932.

## Evidence

| Check                                                   | Result                                                                                                                                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint / TypeScript                                     | Pass, no lint warnings                                                                                                                                                                |
| Unit/PostgreSQL integration                             | 37 pass: adversarial roles/RLS, stock, private locations, complete fulfillment/rewards/ledger, payment proof, webhook processing, conversation/matching/images                        |
| Public browser suite                                    | 24 pass, desktop plus three mobile widths; actual map tile/worker loading, focus, profiles and discovery                                                                              |
| Authenticated local browser suite                       | 8 pass, all four viewport sizes; conversational two-roll quote, persistent $9 draft, private address, denied unconfigured payment, cancellation/restock and separated role dashboards |
| Real PostgreSQL/Auth/PostgREST smoke                    | Pass: signup/sign-in, role/payment forgery denied, private address isolation, reservation retries, availability cap and stock restore                                                 |
| Local reset                                             | Verified twice, dedicated loopback backend only                                                                                                                                       |
| Production build                                        | Pass                                                                                                                                                                                  |
| Hosted Supabase public listing read                     | HTTP 200; zero public listings at audit time                                                                                                                                          |
| Sandbox OAuth                                           | HTTP 200; authentication succeeds                                                                                                                                                     |
| Current configured AI model                             | HTTP 404 / model_not_found; unavailable to current key                                                                                                                                |
| OpenAI gpt-4.1-mini                                     | Accessible in model listing; actual structured tool call passed and produced a validated catalog result                                                                               |
| Hosted browser audit                                    | Environment browser connection failed; live HTTP checks and local browser evidence recorded separately                                                                                |
| Hosted buyer capture/authentic webhook/full fulfillment | Not verified; requires seeded/approved data and a buyer-approved Sandbox purchase                                                                                                     |

Complete financial/fulfillment database tests inject service-side payment proof at the test boundary. That verifies database behavior, not a real PayPal payment. Application code contains no fake-success route. Seeded fictional vendors and runners are marked demo; offline catalog/availability are explicitly illustrative. Provider-model prose never determines authoritative prices, inventory or status.

## Deployment steps remaining

1. Apply migrations 008 and 009, once in order, to the existing hosted database. A combined transaction artifact is provided separately. Do not rerun initial setup SQL or reset hosted data.
2. Set Production AI_MODEL to gpt-4.1-mini if using the configured OpenAI provider/key; then deploy the committed Phase 2 application. Other app/domain secrets remain in deployment settings.
3. Seed clearly labeled demo records with secure credentials or import operator-approved vendors. Configure private pickup addresses, refresh temporary runner availability/trips before presenting.
4. Run an actual Sandbox buyer purchase and verify registered webhook replay, complete role fulfillment, final stock/rewards/events/ledger. See paypal-verification.md.

## Limits and Phase 3

No real payouts/reward partners, refunds/disputes or automated pending-payment reconciliation. Road routing, precise travel-time promises, real-time subscriptions, multi-item carts, full conversation history and nonce-based CSP remain future work. Ranking is advisory: customer/runner blocks and concurrent state changes can still cause acceptance rejection even after a suggestion. Public trip notes/descriptions are public fields; do not enter private addresses there. Vendor batch imports are sequential and may partially complete on a later database error. Local reduced stack excludes hosted Storage and Realtime, and hosted Storage uploads remain unverified. Audit/rate-limit retention jobs and larger-catalog/dashboard pagination require operational work.

Priority Phase 3: finish hosted Sandbox verification and payment reconciliation first; then production monitoring/retention, stricter CSP, Storage integration verification, realistic route estimates and managed map service limits. Preserve the MAP + AI + CONTEXT interface rather than converting discovery to an admin screen.
