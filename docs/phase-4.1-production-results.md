# Phase 4.1 production results — October 9, 2026

## A. Existing implementation — Implemented

Phase 4 already supplied real accounts, vendor and runner onboarding, immutable consent evidence, private PDFs, administrator review, and Sandbox checkout. The prior Phase 4.1 branch already implemented durable notification retries, a signed delivery-event webhook and readable PDFs. It had not been promoted to main. This release reuses it and preserves the later README edit.

## B. Root causes — Verified / partially diagnosed

The original email was blocked with EMAIL_NOT_CONFIGURED and no provider receipt. Production lacked the Resend key and sender at the initial audit. The operator has now supplied the key; the sender is present. Earlier PDFs rendered application JSON and separated the signature from identifying consent details. The recovered formatter fixes this presentation.

Historical PayPal OAuth failed because Live credentials were used against Sandbox. Current cloud Sandbox OAuth returns HTTP 200. The prior capture now reports COMPLETED while the expired demo order remains locally PENDING_PAYMENT: reconciliation remains outstanding. No charge, refund, forced payment transition or payout was performed. The Sandbox app accessible to the cloud has no registered matching production webhook; verify the app actually used by Vercel.

Historical P0001 lacks enough request context for exact attribution. Local submitted-application editing reproduces the expected P0001 guard. New logs add a constant RPC operation and sanitized SQLSTATE, without private database messages. The reproduction does not identify every old production error.

## C. Changes — Implemented / Tested

Recovered the prior queue, safe retries, private presentation registry, structured PDF template, administrator notification controls and signed Resend webhook. The additive migration is confirmed applied (phase41_ready true); it was not reset or rerun. Added administrator-only, read-only Sandbox authentication diagnostics and safe database operation context. Original payment validation and processing behavior are unchanged.

Production RESEND_API_KEY and ONBOARDING_EMAIL_FROM bindings are now present. CRON_SECRET and ONBOARDING_EMAIL_TO were already present. No secrets are included in source, reports or logs. Deployment verification is appended below after the main pipeline finishes.

## D. Test evidence — Tested / Verified

- 64 unit and contract tests passed, zero failures or skips, during this audit.
- 24 connected local browser regressions passed across desktop and mobile widths; four additional administrator diagnostics browser tests passed.
- Local database/provider integration verified persisted transient failure, byte-identical retry payload and idempotency key, accepted receipt reconciliation, refusal to resend an accepted notification and retention of one consent record.
- Final lint, type checking and production build passed.
- Hosted original signed record fingerprint remains df8d69ff8bd223a400f61682390e85cb75d5696eea7ff66c1b2705e51aa9a022. Original private PDF SHA256 remains f58adc436fb923732bdad3ff74ec8acf2b80c57dce6c7aabec3dd4d5756f3856, matching downloaded bytes and registry.
- Separate readable-v1 presentation: 26,688 bytes, registry and actual SHA256 match. Prior signed private download returned HTTP 200 and public access was blocked. Actual mobile viewing of the private hosted PDF remains unverified.
- The selected original historical notification was accepted through the trusted cloud server: Resend receipt 01a1230e-17df-7825-a4aa-531cef325e5d, persisted sent/accepted, attempts 2, no error. This is provider acceptance, not proof of inbox delivery or use of Vercel's new key. It must not be resent to manufacture another test.

## E. Production verification — pending release checks

The operator's key setup deployment dpl_BSw3KEftCuBHSedUsbWhkyGXLtjp is READY but still runs the previous 0ad51e4 source. Release deployment evidence will be appended after promotion. The signed test application remains submitted and unapproved. No consent, original PDF, signature, listing publication, demo reset or production seed was changed.

## F. Remaining blockers — Blocked / unverified

Confirm recipient inbox delivery or configure the signed Resend delivery webhook and its RESEND_WEBHOOK_SECRET. A sending-only cloud key cannot read provider message history (HTTP 401 restricted_api_key). Vercel variable presence does not prove its newly entered key can send; a genuine new application or authenticated administrator workflow must verify dispatch there without duplicate historical email.

Verify/register the Sandbox PayPal webhook on the app Vercel actually uses, and reconcile the completed capture through an authorized payment task. Changes to processing behavior require approval under the brief. Historical request-specific P0001 attribution and a clean 24-hour runtime history are unavailable through the current live log stream.

## G. Readiness — not fully verified

Local implementation is tested and production schema/configuration prerequisites are present. Phase 4.1 must not be called end-to-end complete until production dispatch/delivery and authenticated operator download checks are verified. Phase 5 readiness remains conditional on those checks and the unresolved payment reconciliation baseline. No Live payments or payouts were enabled.
