# Phase 4.1 test and release evidence

Verified 2026-10-08 in the Codex cloud workspace. Read `phase-4.1-hotfix.md` for diagnosis, configuration, retry policy and deployment instructions.

| Check                                                           | Result                                                                                                                                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original hosted submission exists and unchanged                 | Passed: complete record fingerprint compared before/after                                                                                                           |
| Original hosted private PDF exists and unchanged                | Passed: actual downloaded bytes match original registered SHA256                                                                                                    |
| Fabricated vendor remains unactivated/unpublished               | Passed: application remains submitted; no approval or publication action performed                                                                                  |
| Unit/database/security/PDF tests                                | 60 passed, 0 failed, 0 skipped                                                                                                                                      |
| Connected browser regressions                                   | 24 passed, 0 failed across desktop and 360/390/430 widths; customer/vendor/runner/Demo Mode/admin                                                                   |
| Lint and TypeScript                                             | Passed                                                                                                                                                              |
| Production build                                                | Passed                                                                                                                                                              |
| New PDF labeled fields, multiple products and currency          | Passed: actual generated PDF text extracted with pdftotext                                                                                                          |
| Original 12-section legal text retained                         | Passed: every complete heading/body compared after whitespace normalization                                                                                         |
| Signature placement and no unintended blank page                | Passed: first-page signature beside consent/identity; page text assertions and visual first-page inspection                                                         |
| Admin retries, error display, mobile layout                     | Passed against local authenticated server/database; remote sender credentials intentionally cleared                                                                 |
| Non-admin retry/presentation access denied                      | Passed: actual HTTP 403 and database permission/RLS checks                                                                                                          |
| Provider acceptance of diagnostic notification                  | Passed: actual Resend message ID `01a11b2e-a487-7e09-8e8c-fce626ceb430`, recipient `aibrymusic@gmail.com`                                                           |
| Provider-confirmed delivery or recipient inbox                  | Unconfirmed; no actual delivered webhook or recipient confirmation                                                                                                  |
| Signed webhook security, replay/order and stored delivery state | Passed locally; no claim of live webhook configuration                                                                                                              |
| Notification/PDF pipeline with hosted Phase 4.1 schema          | Pending operator SQL upgrade                                                                                                                                        |
| Actual local server queue integration                           | Passed: real local Auth/PostgREST/PostgreSQL, injected provider failure then acceptance, early delivery-event reconciliation and third send refused; no remote mail |
| Original historical notification retry                          | Pending selected admin action after deployment; no bulk retry                                                                                                       |
| Hosted presentation copy                                        | Pending Phase 4.1 migration and administrator generation                                                                                                            |
| Main-to-Vercel deployment                                       | Staged on `codex/phase-4.1-notifications`; not yet deployed                                                                                                         |

The original queued notification was `blocked`, attempts 1, error `EMAIL_NOT_CONFIGURED`, with no provider receipt. The separate diagnostic send proves current cloud Resend sending works; it does not establish Vercel variables or inbox delivery. The current key's provider history/domain read requests returned HTTP 401 `restricted_api_key`.

Remaining setup: run `docs/sql/phase-4.1-upgrade.sql`; configure Vercel Production `ONBOARDING_EMAIL_TO=aibrymusic@gmail.com` and a random `CRON_SECRET`; verify its existing Resend API key/sender and APP_URL. Optionally configure the signed Resend delivery webhook and `RESEND_WEBHOOK_SECRET`. The daily Hobby-compatible retry worker has up to one-day latency and safely blocks uncertain sends older than the provider deduplication window. Never approve the fabricated original vendor to test notifications.

Cloud startup instructions and the non-secret recipient requirement were saved as a configuration draft. They require review/save/publication separately from the app deployment. No package dependency or PayPal code was changed.

The additional queue smoke initially caught changed JSON property ordering after database persistence. Canonical request serialization fixed it; the repeated smoke passed with byte-identical bodies and stable idempotency keys.
