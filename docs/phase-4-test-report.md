# Phase 4 test and release report

## Implemented

Reviewed vendor/runner applications, verified-email customer consent gating, account privacy/addresses/deletion requests, immutable agreement versions and submissions, complete PDF generation, private Storage policies and authorized short-lived downloads, private photo review, administrator controls and audit history, and retryable Resend notifications.

Original twelve-section VDPCP preserved from the user's blank PDF. Commercial permissions and real payouts are not implied.

## Tested

- Final unit/database suite: **56 passed** (46 existing plus 10 Phase 4 tests), no skipped tests. Covers Auth evidence/Terms gating, immutable versions/signatures, serialized queue claims, email retry/receipt semantics, approval/rejection/idempotency, retention-aware deletion, role escalation, cross-account/demo isolation, private Storage RLS and complete PDF generation.
- Final connected browser suite: **24 passed** across desktop and 360/390/430 px. Includes twelve Phase 4 checks plus twelve marketplace/Phase 3 regressions. Actual local Auth registration, token-hash confirmation and password recovery run against GoTrue; no inbox delivery is inferred. Private customer preferences/addresses, full twelve-section vendor consent, runner consent, keyboard signature persistence, resume drafts, duplicate submission, administrator review/rejection, unauthorized admin requests and mobile overflow are exercised.
- `npm run lint` and `npm run typecheck`: passed.
- Production compilation/start: passed as part of browser verification. Deployment tracing includes the bundled PDF Unicode font.
- Additional PDF text extraction using `pdftotext` confirms every original section heading and complete substantive text is present, together with completed signer information. The generated file is a clearly fictional local fixture, not a real signed agreement.

The reduced local integration stack has real PostgreSQL, Supabase Auth and PostgREST but no Storage/SMTP/Realtime. Consent persistence and pending-PDF recovery are exercised against that stack. Unit Storage tests execute restrictive RLS policies against an existing permissive object policy. A separate hosted Storage probe also passed: a temporary fictional PDF uploaded privately, anonymous listing was denied or empty, public object download was blocked, and a 60-second signed download returned HTTP 200. Only the temporary probe object was removed afterward; no application or consent evidence was created, replaced or deleted. Unit approval uses explicitly named UNIT-FIXTURE document references; it does not claim actual private object uploads.

## Deployed / verified / blocked

Phase 4 application commit `81e9ce7` was released to main and verified live on October 8, 2026 after the user applied the hosted additive migration. Schema readiness, three active agreement definitions, the private consent bucket and the user-selected verified real administrator membership were confirmed. Production `/agreements` returns HTTP 200 with the original VDPCP, `/api/demo` remains enabled, and anonymous `/admin/onboarding` access displays the access-required screen. Real applicant submission/approval, inbox verification/recovery, Resend acceptance/inbox receipt and genuine Sandbox buyer approval/capture/webhook still require separate live evidence.

No prospective real vendor has been seeded or published. No payment or payout success is fabricated.

## Actual production Sandbox attempt (October 8, 2026)

A new isolated fictional customer workspace created a cart and order through the live authenticated APIs. `/api/checkout` returned HTTP 503 with the server's PayPal Sandbox authentication failure message. Test order `ebf75675-04c9-4371-8fa8-31484ab9e610` stayed DRAFT with no bound PayPal order or capture. It was canceled through the authenticated API, restoring its fictional stock while retaining history, and the demo was signed out. Buyer approval/capture/webhook verification cannot proceed until the Vercel Sandbox credential pair is accepted. No paid state or payout was manufactured.

Cloud Sandbox OAuth independently returned HTTP 200 with an access token present (token not logged). This verifies cloud credential usability, not Vercel credential configuration or payment capture. The live application's OAuth failure therefore requires checking its Production environment bindings and redeploying before another buyer checkout attempt.
