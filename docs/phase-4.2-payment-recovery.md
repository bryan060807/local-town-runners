# Phase 4.2: Sandbox capture recovery — October 10, 2026

## A. PayPal transaction findings — Verified

| Evidence                                | Value                                                |
| --------------------------------------- | ---------------------------------------------------- |
| Buyer receipt transaction               | `3CK819654R8734537`                                  |
| Associated PayPal order                 | `2H896866K62686904`                                  |
| Canonical receiver-side capture         | `2RA30218PE716183N`                                  |
| Marketplace order                       | `8ffc44db-c4a8-43fd-b67b-aa7ff8943b5c`               |
| Amount and currency                     | $35.00 USD                                           |
| PayPal order status                     | COMPLETED                                            |
| Both transaction/capture resource reads | PENDING, status_details.reason ECHECK                |
| Capture creation time                   | 2026-10-10T07:43:11Z                                 |
| Canonical purchase units                | One; matching internal custom_id and expected amount |
| Canonical receiver captures             | One final_capture record; pending funding            |

These are actual Sandbox GET responses using the authorized server credentials. Both resource IDs link to the same PayPal order. Reconciliation uses the capture in the canonical merchant order, not an interchangeable buyer receipt ID. A completed parent order and a buyer receipt do not establish completed capture. No additional financial API call was made during this repair. OAuth requests and provider reads are not additional captures.

## B. Root cause — Verified current-path reproduction

The original validation accepts only capture.status COMPLETED. The canonical order's identity, internal UUID and $35 USD amount pass validation, but its capture.status PENDING fails validCapture. Reproducing the deployed reconcileOwnedCapture against that actual retrieved order raises Payment not confirmed, with zero capture calls. Pending eCheck funding is therefore a verified sufficient cause of the rejection. The missing post-capture custom_id hypothesis is not established by the available evidence: historical POST response bodies are unavailable, so this report does not assert that every earlier response had the same structure.

The old interface collapsed pending funding into HTTP 409 and a generic error. It also offered another checkout for a bound pending order. The repaired capture endpoint reports a verified pending capture with HTTP 202 and explains the eCheck. It does not turn pending funding into PAID.

PayPal's official API specification documents PENDING capture status and ECHECK as an incomplete-capture reason. It also documents differing capture response representations and six-hour default PayPal-Request-Id retention. That finite window makes blind long-delayed retries unsafe.

Reference: https://github.com/paypal/paypal-rest-api-specifications/blob/main/openapi/checkout_orders_v2.json . Retrieved over verified HTTPS during this run.

## C. Code changes — Implemented / Tested

- `src/lib/payment-validation.ts`: canonical ownership/amount checks, exact decimal money parsing, single purchase unit and capture, nonempty capture ID, completed/pending/failed/review distinctions. Existing captures are never recaptured. A financial response is followed by fresh canonical GET rather than assuming optional metadata is identical. A timeout also triggers read-only recovery.
- `src/lib/payment-recovery.ts` and `src/lib/server/payment-recovery.ts`: shared verified capture confirmation, safe local failure status, permanent capture-attempt claim, observation persistence and allowlisted correlation/stage logs. Capture is disabled by default.
- `src/app/api/capture/route.ts`: customer ownership, same-origin and rate limits retained; an explicit approved capture must acquire the database claim. A completed existing capture is reused. Pending funds receive a truthful HTTP 202 response.
- `src/app/api/payments/status/route.ts`: customer-owned existing-order check; never creates or captures a payment. It may reconcile an already completed provider-verified capture.
- `src/app/api/checkout/route.ts`: checks the existing bound payment before offering approval. Pending, completed, failed or ambiguous payments do not initiate another checkout. New checkout requires the additive migration to be ready.
- `src/lib/webhook-processing.ts` and `src/lib/server/paypal.ts`: signed canonical verification shares the same association, total and capture rules. Pending/out-of-order events cannot credit unsettled funds. A premature completion event requests retry. Malformed certificate URLs are rejected before provider verification. Signature verification and actual event IDs remain required.
- `src/components/PaymentActions.tsx` and dashboard: clear approval, capturing, pending eCheck, verified captured-but-unconfirmed, failure and review messages. Unclear status exposes the existing-status check rather than another payment. Generic action status no longer renders an empty duplicate live region.
- Administrator `/admin/payments` adds `/api/admin/payment-recovery`: real administrator only, read-only provider access, verified reconciliation only. It can check an existing order after a demo identity expires without reopening that identity or charging again.

No Live endpoint, payout transfer, order-owner bypass, unverified PAID update or automatic fresh capture was added. Existing sandbox idempotency keys remain unchanged. Public responses/logs contain no buyer financial details, OAuth tokens or secrets.

## D. Database reconciliation — Verified / pending provider completion

The additive `014_phase42_payment_recovery.sql` is mirrored exactly in `docs/sql/phase-4.2-upgrade.sql`. The operator applied it, and hosted phase42_ready returned true. It does not reset production data.

The service-only claim is row-locked. Historical bound pending orders are conservatively marked as already attempted because earlier requests did not leave durable attempt evidence. New attempts are recorded before a financial request, are never automatically cleared, and cannot authorize another capture after an uncertain outcome—even after PayPal's idempotency window expires. A concurrent request that sees a completed order receives a safe no-claim result and re-reads canonical proof.

The established confirm_payment RPC remains the financial state authority. It locks the order, validates expected amount and payment identifiers, rejects conflicting capture/event IDs, retains unique capture IDs and ledger kinds, and makes manual/webhook replay safe. Fresh confirmation creates exactly four ledger entries. Vendor, runner and platform allocations remain simulated; the customer entry represents verified Sandbox capture, not a live-money transfer.

The $35 order began PENDING_PAYMENT with no local capture, payment event or ledger. While PayPal reports PENDING/ECHECK, its correct state remains PENDING_PAYMENT with no payment credit. The status observer records the receiver capture and pending reason separately; these observations do not constitute confirmation. Once PayPal reports a matching COMPLETED capture, the status/admin/webhook paths can invoke the existing RPC without recapturing.

## E. Verification — Tested / release checks pending

- 79 automated tests passed, zero failures or skips: amount/currency/association, response shape differences, pending funds, timeouts, database failure recovery, conflicting IDs, replay, concurrency and RLS, plus existing project regression coverage.
- 32 connected browser tests passed at desktop and 360/390/430 widths, including new pending/confirmed UI fixtures, hidden duplicate-payment controls, real unauthorized endpoint checks, and existing onboarding/vendor/runner/customer flows. UI fixtures are not actual Sandbox success evidence.
- Four additional administrator browser checks passed across all viewports, covering anonymous/nonadministrator denial, UUID validation, recovery form and existing diagnostics.
- Real local Auth/PostgREST/PostgreSQL integration made one mocked capture under concurrent requests, recovered a simulated timeout through canonical read, preserved the attempt boundary, and created exactly four ledger entries despite manual/webhook replay. A separately claimed uncertain order stayed under review with zero further capture calls. No remote provider was used by these fixtures.
- Final lint and type checking passed. Production build and deployment evidence are appended after release checks.

The first browser run was stopped after identifying an empty duplicate status region; that defect was corrected and the complete 32-test rerun passed. An initial new database test fixture used an address below the existing minimum length; the fixture was corrected and the complete suite passed. No protection or assertion was disabled.

## F. Outstanding issues — Blocked / operator verification

The original eCheck is still PENDING at the audited provider boundary. Do not pay again or mark it paid based on the receipt. Check the existing payment status after provider settlement; request support/provider review if it remains pending. Any additional Sandbox capture requires explicit user approval and was not performed by this repair.

The Sandbox app available to the current cloud credentials returned an empty webhook list. Configure the app actually used by Vercel with `https://runners.aibrylabs.com/api/webhooks/paypal`, at least PAYMENT.CAPTURE.COMPLETED and PAYMENT.CAPTURE.PENDING events, and its correct Sandbox PAYPAL_WEBHOOK_ID in Vercel Production; redeploy after changing that binding. The old cloud ID did not match a registered hook. Vercel's sensitive credentials were not retrieved or replaced. Without signed real provider delivery evidence, the automated webhook path is Tested, not Verified in production. Manual read-only recovery does not depend on a webhook.

Authenticated customer/administrator production viewing requires their own session; testing never impersonates the operator. Production anonymous guards and actual trusted server provider/database results are verified separately. This phase is not called end-to-end complete while the payment is pending or those operator checks remain unverified.

## Hosted recovery observation — Verified

After schema readiness was confirmed, the trusted server recovery function ran with capture disabled against the actual $35 order. It returned capture_pending, providerStatus PENDING, pendingReason ECHECK, captureId 2RA30218PE716183N and the message: “PayPal is processing your eCheck. Your payment has not completed yet. Please do not pay again.” The same safe observation was persisted. A follow-up database read confirmed PENDING_PAYMENT, paypal_capture_id null, payout_status SIMULATED and an empty ledger. The historical attempt guard remained present. This is actual provider/database evidence, not a UI fixture or a claim that funds completed.
