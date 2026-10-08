# Phase 3 test report

## Verified application behavior

- Unit/database suite: **46 passed**. All ordered migrations execute in PostgreSQL-compatible PGlite. Tests exercise real RLS/role permissions, stock reservation/retry/cancel, multi-item totals/snapshots, workspace visibility, normal-user exclusion, role immutability, disabled/expired demos, fictional address enforcement, service quote separation, private credential encryption/tampering, entry limits, declined offers, compatibility with every cart line, refund state/stock/ledger idempotency and existing capture/webhook adversarial checks.
- Connected local browser suite: **12 passed**, including the new **4-test** demo walkthrough on desktop and widths **360, 390 and 430**. Real local GoTrue cookie sessions enter demo and switch customer/vendor/runner; cart state persists; unauthorized switch is rejected; missing PayPal configuration preserves DRAFT; the same fixture order traverses vendor acceptance through delivery/completion and awards rewards once. Customer quote inquiry persists. A final four-viewport rerun also verifies actual vendor price/stock edits appear for the customer, public runner profiles work, and exit revokes the switch ticket and signs out. Cart/dashboard have no horizontal overflow.
- Public/offline browser regression suite: **24 passed** across desktop and mobile, including map tiles/worker, catalog discovery, profiles, accessibility controls and explicit previews.
- Local reset smoke: passed; all orders, capture/refund IDs, ledger entries and normal identity IDs match the before-reset snapshot exactly. Only visitor demo expiries change; the template remains active.
- `npm run lint`: passed without warnings.
- TypeScript and production builds: passed. Both browser suites built and started the production app.

Local fulfillment tests deliberately use service-only `LOCAL-TEST-*` capture fixtures in the dedicated loopback backend after verifying real checkout is unavailable. This is not an actual PayPal payment, and the application offers no fixture or mark-paid endpoint. Storage/Realtime are unavailable in this reduced local stack.

## Release status

Phase 3 code is prepared on `codex/phase-3-demo`; production release awaits the hosted migration. The current production homepage returns HTTP 200, and `/api/demo` returns 404 because Phase 3 is not released there yet. Updated cloud startup instructions were saved as a draft; environment publication is separate.

## External prerequisites and unverified checks

Hosted Supabase reports Phase 3 readiness RPC missing (`PGRST202`), so migrations must be applied before seed/deployment. The SQL Editor artifact is `docs/sql/phase-3-upgrade.sql`; database management credentials are not supplied to this environment. Application deployment must not replace Phase 2 with schema-dependent code before that upgrade.

Actual Sandbox buyer approval, completed capture, genuine webhook reconciliation and provider refund have **not passed** in this phase. A browser buyer approval is required. OAuth/REST configuration alone is insufficient. Vendor/runner transfers are intentionally simulated and actual payouts remain zero.

## Executable verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e:local
```

Start `local:backend`/`local:gateway` and run both local seeds first. Keep port 3000 free; Playwright builds/starts its own production app. The final hosted walkthrough follows `phase-3-demo-guide.md`. Record actual order/capture/refund IDs and states without secrets, then replay the real capture/webhook and inspect unchanged ledger counts. Inspect Vercel logs by stage if OAuth/signature/capture fails.
