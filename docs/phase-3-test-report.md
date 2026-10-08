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

On October 8, 2026, the hosted upgrade was verified (`phase3_ready=true`), the fictional template was seeded and verified, and application commit `4478214` was released to `main`. The live homepage and `/api/demo` return HTTP 200. A separate live smoke test verified genuine authenticated Customer → Vendor → Runner → Customer switching, customer cart access and sign-out on `https://runners.aibrylabs.com`. No payment was manufactured or attempted by that smoke test. Updated cloud startup instructions were saved as a draft; environment publication is separate.

## External prerequisites and unverified checks

The user applied `docs/sql/phase-3-upgrade.sql` through the hosted SQL Editor. Hosted schema, enabled demo mode, four fictional unverified template vendors and 25 persisted listings are verified. Database management credentials are not supplied to this environment; subsequent schema changes still require the SQL Editor or another authorized migration workflow.

Actual Sandbox buyer approval, completed capture, genuine webhook reconciliation and provider refund have **not passed** in this phase. A browser buyer approval is required. OAuth/REST configuration alone is insufficient. Vendor/runner transfers are intentionally simulated and actual payouts remain zero.

## Executable verification

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e:local
```

Start `local:backend`/`local:gateway` and run both local seeds first. Keep port 3000 free; Playwright builds/starts its own production app. The final hosted walkthrough follows `phase-3-demo-guide.md`. Record actual order/capture/refund IDs and states without secrets, then replay the real capture/webhook and inspect unchanged ledger counts. Inspect Vercel logs by stage if OAuth/signature/capture fails.
