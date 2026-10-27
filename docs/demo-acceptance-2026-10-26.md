# Demo acceptance — October 26, 2026

This pass checks the visible customer, vendor, runner and administrator workflows. It uses the connected local PostgreSQL/Auth/PostgREST backend, desktop Chromium and 360/390/430 px mobile viewports. Actual Sandbox payment proof remains separately recorded in [Phase 4.3](phase-4.3-sandbox-verification.md).

## Improvements found during acceptance

- Listing search was hidden by the responsive CSS below 1050 px. It now stays visible below the category tabs, fits the available width and has a 44 px touch target with 16 px input text.
- AI search instructions and tool descriptions now require actual catalog title words/categories and integer USD cents. Descriptive requests must not turn unsupported materials/features into strict search keywords or invent product attributes. Price, inventory, ownership and financial write validation remain server-enforced.
- Added two browser scenarios that use the actual visible controls for the complete fulfillment path and discovery/quote interactions. Previous fulfillment coverage used API calls for several state transitions; the additional scenarios exercise the button wiring itself.

## Coverage

| Area                    | What is exercised                                                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery               | Natural-language suggestions, follow-up context, category filters, made-local filter, search, empty results and storefront browsing                                                      |
| Map                     | Rendered map controls/markers, approximate browser-only location and geolocation permission flow                                                                                         |
| Product details         | Quantity changes, reviewed prices, modal keyboard interaction and Escape dismissal                                                                                                       |
| Cart                    | Actual Add to cart, per-vendor preparation, fixed fictional address, remove/empty state and persisted inventory reservation                                                              |
| Customer                | Draft persistence, missing-provider checkout failure without forged payment, final completion, review submission and quote response visibility                                           |
| Vendor                  | Own catalog editing, visible Accept paid order, Find a runner and Mark ready for pickup controls                                                                                         |
| Runner                  | Availability, transportation, maximum detour, trip intention, visible Accept run, pickup, delivery and delivered controls; completed-run/reward accounting                               |
| Privacy and isolation   | Exact fictional delivery address hidden before assignment, another demo cannot access an order/capture, demo ticket expiration and restricted administrator APIs                         |
| Accounts and agreements | Registration, local email-token confirmation and recovery, customer consent, vendor/runner application drafts, signatures, immutable duplicate submissions and retained rejected consent |
| Payment UI              | Accurate pending eCheck/captured-confirmation states, no repeated-payment buttons, administrator recovery access and missing-local-credential diagnostics                                |
| Responsive layout       | Desktop and 360/390/430 px workflows, no horizontal page overflow, screenshots of completed local fixtures and quote states                                                              |

The local payment setup for fulfillment is explicitly a **SIMULATED LOCAL FIXTURE**, guarded to the loopback backend and named `LOCAL-ACCEPTANCE-*`. It is not a new PayPal capture, is never run against hosted orders, and does not add a public payment-bypass endpoint. Vendor/runner allocations remain simulated and actual payouts remain zero. A real Sandbox capture and local fulfillment fixture are separate evidence sources.

## Hosted checks

A fresh fictional production demo session exercised non-scripted provider-backed AI discovery for a mug under $30, contextual item details and a two-item quote. Returned IDs/prices were checked against that workspace's actual stored catalog. The quote created **zero** orders and initiated **zero** payments. A more descriptive material-specific query returned no matches in an exploratory check; material details absent from the catalog must not be invented to manufacture a match.

The same temporary demo exercised hosted image processing: SVG was rejected, a 48 px PNG avatar was accepted, the public result was WebP with no EXIF data, and only that newly created test object's reference/file was removed afterward. The demo was exited. No original image, agreement, production application, payment or email was changed or sent by these checks.

The reduced local stack omits hosted Storage/SMTP/Realtime. Browser checks of local consent/PDF retry and local Auth tokens are not inbox-delivery or actual private hosted PDF-upload claims. Existing separate hosted email/private PDF evidence is documented in the Phase 4.1 reports. This pass does not submit new real agreements or send notification emails.

## Reproduce safely

Use the existing checkout and Node 24. Start `npm run local:backend` and keep `npm run local:gateway` running. Then run `npm run local:seed`, `npm run local:seed:phase3` and `npm run local:seed:phase4` with the documented local wrappers. These wrappers override hosted variables and clear remote payment, AI and email credentials. Do not copy production values into `.local-backend/` or reset hosted data.

With port 3000 free, run `npm run test:e2e:local`. The runner builds and starts its own production server. The additional scenarios live in `e2e-local/acceptance.spec.ts`; `npm run test:e2e:local -- e2e-local/acceptance.spec.ts` runs only those scenarios. Use `npm test`, lint and type checking for the remaining checks. Browser screenshots and sanitized machine-readable results are recorded with the final result below.

## Presentation boundary

Use [the judge walkthrough](hackathon-demo.md) for a short, reliable demonstration. Public Demo Mode is isolated and lasts six hours. A fresh demo does not inherit old paid orders. Hosted checkout requires explicit Sandbox buyer approval and PayPal can hold a capture longer than the demo session. Do not put a fresh charge on the critical path of the presentation or describe a local fixture as a genuine provider capture.

Real-phone Safari/Android touch behavior, a new real vendor's legal consent and a new inbox-delivery test are not claimed by a Chromium viewport pass. A brief personal phone review and pitch rehearsal are worthwhile final human checks; they are not prerequisites for the automated acceptance work.

## Final result

**40 browser checks passed** across the four viewports, with zero failures, skips, flaky outcomes or automatic retries in the final matrix. **79 unit/database tests passed**, with zero failures/skips. Lint, explicit type checking, the production build and npm audit passed; the audit reports zero vulnerabilities. Machine-readable evidence is in [the acceptance evidence directory](evidence/demo-acceptance-2026-10-26/).

One earlier full-matrix run hit the 15-second heading wait while the 430px profile switch displayed a loading screen. The same scenario passed in an isolated traced rerun without changing assertions/timeouts. That trace returned successful dashboard responses, with a longest completed transfer of about 5.05 seconds. The entire 40-case matrix was then repeated with failure tracing and passed. The earlier delay was not reproduced; this records the timing observation rather than claiming a definitive infrastructure root cause. Raw traces are not published because they may contain local authentication headers.

### Screenshots — simulated local fixtures

These are real screenshots of the connected local UI. Their payment setup is a local database fixture, not a new PayPal transaction. The separate Phase 4.3 report contains genuine provider evidence.

- [Desktop: completed customer fixture](screenshots/acceptance-2026-10-26/SIMULATED-LOCAL-FIXTURE-desktop-customer.png)
- [360px: completed customer fixture](screenshots/acceptance-2026-10-26/SIMULATED-LOCAL-FIXTURE-mobile-360-customer.png)
- [390px: simulated runner earnings](screenshots/acceptance-2026-10-26/SIMULATED-LOCAL-FIXTURE-mobile-390-runner.png)
- [430px: quote response without an order](screenshots/acceptance-2026-10-26/LOCAL-DEMO-mobile-430-quote.png)

### Release

The mobile search and AI grounding improvements are prepared for the existing main-to-Vercel release. Deployment readiness and a post-release hosted smoke observation are appended after verification. No new migration, buyer charge, real payout, real vendor activation or email send is required.

## Deployed and checked live

Application commit `560d4182b6b7f9ec26e1cd62526b7551184577d4` is READY in production deployment `dpl_FuYvwzHpEmyTYSEwoq9osjfv8E1L`. The project production target and runners.aibrylabs.com alias match that release. Mobile search and the catalog-grounding instructions are deployed.

Post-release checks verified the non-scripted mug recommendation under $30, contextual item details, an explicitly reviewable two-item quote and zero created orders. A material-specific request still conservatively returned no matches; unsupported attributes were not invented. Fresh-demo Vendor, Runner, Customer and Runner dashboards rendered their correct identities with successful full responses measured at about 0.62–0.86 seconds in these four API observations. This is an observation, not a performance SLA or a native-phone benchmark. Avatar validation, WebP processing/retrieval, metadata stripping and deletion of only the new test object passed again; the test demo was exited.

The actual production page was also rendered in Chromium at 360×800. Search remained visible, used 16 px input text, filtered the live catalog to the cinnamon-roll listing, and produced no horizontal overflow or page errors. The managed-browser transport fetched original production responses using Node’s verified system CA/proxy, preserving body bytes/statuses; encoding headers were normalized after decompression. No TLS verification was disabled, no responses were mocked and only GET/HEAD requests were allowed in this visual check. See [the live mobile screenshot](screenshots/acceptance-2026-10-26/LIVE-PRODUCTION-mobile-search.png) and its sanitized transport record.

All three original hosted financial snapshots match the pre-acceptance baseline: three PAID orders totaling $44.00, one customer-payment entry each, unchanged allocations and no new charge or real payout. Existing legal agreements/applications were not modified. These observations are saved in the acceptance evidence directory; no operator login, real account password or private trace was published.
