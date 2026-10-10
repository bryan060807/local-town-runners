# Phase 4.1 production audit — October 9, 2026

This audit began read-only. The running application was deployment `dpl_EhHpPt3xptNn8brp12ijKuFGhF85`, READY, source `0ad51e4f59dfc36b28035a204632872763163af5`. The initial local checkout was stale at `074b4db`; explicitly fetching current remote refs recovered the actual Phase 4 main branch and the prior Phase 4.1 review branch. No production rollback or rebuild of the application architecture was performed.

## Existing implementation classification

| Feature                                           | Audit classification                                                           | Evidence                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Real account and vendor/runner onboarding         | Already implemented; production baseline preserved                             | Phase 4 code on main; phase4_ready true; existing submitted vendor record retained                                                                    |
| Versioned agreement and original private PDF      | Already implemented and verified                                               | Complete signed-record fingerprint unchanged; downloaded original bytes match registered SHA256                                                       |
| Admin access controls                             | Already implemented; production anonymous guard verified                       | /admin/onboarding returns restricted sign-in content; local authenticated role tests verify admin/owner/demo separation                               |
| Resend integration                                | Partially implemented in production                                            | Existing notification blocked at first attempt with EMAIL_NOT_CONFIGURED; production key/sender names absent                                          |
| Durable retries and richer admin status           | Implemented and previously tested; not deployed                                | Review branch 82b6a49; additive 013 migration absent in hosted database                                                                               |
| Structured PDFs and immutable presentation copies | Implemented and previously tested; not deployed                                | Review branch format code; production still uses Phase 4 raw JSON template; agreement_presentations absent                                            |
| Resend delivery webhook                           | Implemented but production setup missing/unverified                            | Signed handler in review branch; no RESEND_WEBHOOK_SECRET production binding listed                                                                   |
| Sandbox OAuth                                     | Verified in current cloud; historical production mismatch resolved by operator | Token endpoint HTTP 200; earlier Live keys were mistakenly entered for Sandbox; actual production order was subsequently created/captured             |
| PayPal webhook                                    | Blocked/unverified                                                             | App available to the current cloud credential pair has no registered webhook matching runners.aibrylabs.com; configured cloud webhook ID matches none |
| Historical P0001 attribution                      | Partially diagnosed                                                            | SQL raises P0001 for business/security guards; exact old request/function unavailable from current log API                                            |

## Root causes

The original notification for submission `6e9127ae-b6cf-4875-bb92-1e21355c21bd` exists with status blocked, attempts 1, EMAIL_NOT_CONFIGURED and no provider receipt. Production currently lacks RESEND_API_KEY and ONBOARDING_EMAIL_FROM, although both are available in this cloud. Cloud settings do not configure Vercel. The prior Phase 4.1 migration and code were never promoted, so production has neither the new retry lease/attempt metadata nor the improved template/presentation registry.

PDF presentation issues come from the deployed template calling JSON.stringify on the application and adding a large signature block after the entire document. The recovered formatting implementation replaces this with labeled fields/product blocks and places signature/identity/consent/time together, preserving accepted section text.

Earlier OAuth failures were caused by Live credentials being used against api-m.sandbox.paypal.com. Operator replacement with Sandbox credentials allowed production checkout. The older $56 test must not be called paid merely because PayPal's parent order says COMPLETED: its capture status and matching amount are checked separately. On the October 9 audit read, PayPal reports the capture itself COMPLETED, while the app still shows PENDING_PAYMENT without a registered capture. This is a payment reconciliation gap; no payment state was manually changed. The original demo order remains stored even after its demo workspace expires; a new demo session is intentionally isolated from the old identity.

P0001 is PostgreSQL's default SQLSTATE for RAISE EXCEPTION. Examples include invalid/unverified real accounts, submitted-application edits, invalid acknowledgments/signature, unavailable/disabled/expired profiles, orders outside allowed states, runner eligibility and workload guards. This run reproduces the exact save_application error 'Submitted applications are immutable' against a local submitted fixture. That is expected protection. This reproduction does not establish the source of any particular historical production P0001 log. The improved logging includes a constant operation name and SQLSTATE, never the provider/database payload or application details, so future failures can be attributed safely. Payment validation, state transitions, idempotency and payouts remain unchanged.

## Preservation evidence

Original signed-record fingerprint: `df8d69ff8bd223a400f61682390e85cb75d5696eea7ff66c1b2705e51aa9a022`.

Original actual PDF SHA256: `f58adc436fb923732bdad3ff74ec8acf2b80c57dce6c7aabec3dd4d5756f3856`.

The fabricated vendor application remains submitted. No vendor role activation, listing publication, production seed/reset or consent/signature/version replacement is authorized by this repair.

## Changes in this audit run

Recovered the existing Phase 4.1 implementation instead of recreating it and merged the user's later README edit. The existing 013 SQL remains unchanged; it must run once only after the read-only audit confirmed it absent. Added admin-only read-only Sandbox OAuth diagnostics at /admin/payments; it reports configuration format flags, public-client-ID fingerprint, provider HTTP/error/debug code and safe outcomes. It does not create, capture, refund or modify payments and never returns credentials/access tokens. Added database operation context at existing RPC failure boundaries while preserving existing public error/status behavior. Preserved the previously unfinished diagnostic files in a separate workspace copy before switching branches.

See phase-4.1-hotfix.md for the durable worker, retry windows, private presentation copies and signed Resend webhook. Existing historical jobs remain manual-only. The old test's one retry is permitted only after confirming no provider receipt; no historical bulk resend.

## Operator prerequisites and remaining evidence (updated after setup)

The additive SQL upgrade is now confirmed applied (phase41_ready true). Vercel now lists RESEND_API_KEY and ONBOARDING_EMAIL_FROM for Production, and the operator redeployment dpl_BSw3KEftCuBHSedUsbWhkyGXLtjp is READY. Secret values were not retrieved or compared; presence alone does not prove the new key works. These prerequisites no longer require repeating the SQL or adding the same variable again. ONBOARDING_EMAIL_TO and CRON_SECRET are already listed for Production; their secure values are not printed. APP_URL must point to the production domain. For actual delivery/bounce events, configure the Resend webhook and its Vercel signing secret; sending can work without that delivery-event configuration, but acceptance alone is not confirmed delivery.

For PayPal, verify/register a webhook on the Sandbox app actually used by Vercel and update its Sandbox PAYPAL_WEBHOOK_ID. This task does not change payment behavior, enable Live endpoints or manually force pending captures to PAID. Substantial review/payout/fulfillment changes require a separate task.

The current Resend sending-only key cannot read even the previous diagnostic message: HTTP 401 restricted_api_key. Prior accepted diagnostic ID 01a11b2e-a487-7e09-8e8c-fce626ceb430 is distinct from the original application's blocked notification. Actual current acceptance/delivery must be checked after the selected retry; recipient confirmation or an authenticated provider delivery event is required for a delivery claim.

Vercel project/deployment/environment-name read access works. Its documented runtime-log endpoint is a stream; previous bounded reads received no bytes. That does not establish a clean historical 24-hour window. Historical P0001 attribution therefore remains limited by unavailable request/function context.

Current validation and production release results are recorded in phase-4.1-production-results.md. Deployed/verified status is never inferred from a build, local fixture or absence of streamed logs.

The selected original notification retry was accepted by Resend as 01a1230e-17df-7825-a4aa-531cef325e5d. Persisted job_status is sent, provider_event accepted, attempts 2, error_code null. This dispatch ran through the trusted cloud server, not Vercel. Inbox delivery and the newly entered Vercel key remain separate verification items. A separate immutable readable-v1 presentation is stored privately, 26,688 bytes, SHA256 31b1076b16025d70227e0ca90eabd4b97f5f28e75e1a406247f7dff3f2a7a9ca. After these operations both original hashes above still match and the application remains submitted.

The operator confirmed the original notification arrived in aibrymusic@gmail.com. Release 8e866cf is active in READY deployment dpl_4J1zvTMTvc1UfSw4RUkrnNNtUook. Final results distinguish this actual delivery from the unverified new Vercel-key dispatch path.
