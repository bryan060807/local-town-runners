# Local Town Runners

An evolving local commerce MVP: a Louisiana, Missouri map, catalog-grounded discovery, independent vendors, and neighbor-powered pickups. Branding and geography are centralized in `src/lib/brand.ts`. All seeded vendors are fictional and labeled DEMO. 

## Current capabilities

Next.js App Router / TypeScript / React, MapLibre, Zod, Supabase SSR authentication, PostgreSQL migrations with RLS, atomic inventory reservation, deterministic runner matching, role dashboards, state-gated fulfillment, an integer-cent ledger, moderation, reports, reviews, audit events, and PayPal Sandbox create/capture/verified webhook routes.

Without Supabase configuration, browsing uses a fixed illustrative catalog. Order previews neither persist nor charge. Without an AI key, discovery uses deterministic catalog search and matching, labeled as demo discovery. Connected AI uses a validated catalog/order-read tool registry; order preparation creates a quote for explicit review. No model can confirm payments or invoke protected writes.

Phase 2 is deployed at https://runners.aibrylabs.com. Phase 3 adds isolated fictional demo identities, carts, quote inquiries and explicit simulated earnings. See [Phase 3 implementation](docs/phase-3-implementation.md), [judge walkthrough](docs/phase-3-demo-guide.md) and [current test report](docs/phase-3-test-report.md). Actual Sandbox capture and refunds require a buyer-approved hosted test.

## Development

Use Node.js 24 (`.nvmrc`) and npm 11.9.0. Each Codex cloud task is already isolated; use the existing checkout rather than creating a worktree.

```sh
npm ci
cp .env.example .env.local
# Set APP_URL to the actual origin used by your browser.
npm run dev
```

In the cloud workspace use `npm ci --cache /workspace/.npm-cache`, because the default home cache is read-only. The app's Node processes honor the system HTTPS proxy with Node 24's `--use-env-proxy`. Never disable TLS verification.

## Environment configuration

| Variable                                    | Purpose                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `APP_URL`                                   | Exact trusted request origin; local default is `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL`                  | Supabase project URL; public                                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`      | Public publishable key (local anon key also works)                     |
| `SUPABASE_SERVICE_ROLE_KEY`                 | Server-only payment reconciliation and seed/import administration      |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | Sandbox REST app credentials; secret stays server-side                 |
| `PAYPAL_WEBHOOK_ID`                         | Sandbox webhook registration ID                                        |
| `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY`   | Optional HTTPS OpenAI-compatible provider                              |
| `DEMO_SEED_PASSWORD`                        | Local, non-production seed account password, at least 12 characters    |

Enter secrets in secure environment settings or your deployment's secret store. Never paste secrets into chat, commit `.env.local`, or log their values. Missing Supabase URL/key pairs keep browsing in labeled offline mode and disable real authentication/order creation. Integration-specific configuration is validated at use time so offline browsing remains runnable.

## Database and seeds

Apply the files in `supabase/migrations` in order using the Supabase CLI (`supabase db push` after linking your project) or a controlled migration runner. Do not substitute manual UI edits for schema migrations. Review migrations before applying to an existing project.

```sh
# Set Supabase settings and DEMO_SEED_PASSWORD securely in .env.local.
npm run seed
```

Seed tooling creates reserved `.example` demo accounts and 15 DEMO vendors/listings. It never marks fictional businesses verified. Roles are assigned through service-side administration. See `docs/demo.md` for repeatability and reset semantics. Approved real vendors can be imported with `npm run import:vendors -- approved-vendors.json`.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Database tests execute PostgreSQL through PGlite with `auth.uid()`, real RLS policies and nonprivileged roles. They validate database behavior, not hosted Supabase Auth or remote PayPal. Playwright uses installed Chromium (`CHROMIUM_PATH`, default `/usr/bin/chromium`), starts its own production server and checks desktop/mobile discovery and explicit previews. Port 3000 must be free. Use a clean shell without live Supabase variables for the offline E2E suite. The local Supabase smoke script is separate.

## Deployment

Vercel deployment instructions: `docs/deployment.md`. Sandbox configuration and current official API references: `docs/paypal.md`. Database, security, threat model, AI tools, demo and import documents live in `docs/`.

Do not publish the environment or claim live payment readiness solely because the local build passes. Vendor/runner/platform ledger allocations are simulations, never PayPal payouts.

For the tested persistent development backend, see [local backend setup](docs/local-backend.md). Current validation and remaining integration requirements are documented in [build notes](docs/build-notes.md).

Phase 2 audit/hardening: [audit](docs/phase-2-audit.md), [report](docs/phase-2-report.md), [PayPal verification](docs/paypal-verification.md). Existing hosted databases need migrations **008 and 009 in order before deploying these changes**. The current configured AI model failed a provider check; use `AI_MODEL=gpt-4.1-mini` with OpenAI (verified accessible with the configured key), then redeploy. Safe log events expose provider stages/statuses without secrets. Local reset is opt-in: `npm run local:reset -- --confirm-demo-reset`; this destroys only the dedicated local demo data.

## Phase 4 onboarding

See [implementation and operations](docs/phase-4-implementation.md), [test/release evidence](docs/phase-4-test-report.md), and the [hosted additive SQL upgrade](docs/sql/phase-4-upgrade.sql). Apply the upgrade before deploying Phase 4, then run `npm run seed:phase4`. Real vendor consent preserves the original 12-section VDPCP and authorizes Sandbox/demo participation only. Real payments and vendor/runner payouts are not enabled.
