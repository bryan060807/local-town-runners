# Local Town Runners

Discover local goods and coordinate pickups with a neighbor already going that way. Local Town Runners is a hackathon marketplace centered on Louisiana, Missouri, with catalog-grounded AI discovery, vendor storefronts and a complete customer → vendor → runner workflow.

**[Try the app](https://runners.aibrylabs.com) · [Three-minute judge walkthrough](docs/hackathon-demo.md) · [Demo order instructions](docs/demo-order-walkthrough.md)**

The current showcase uses fictional vendors, private demo workspaces and PayPal **Sandbox**. Vendor, runner and platform allocations are simulated; no actual payout is sent. It is not a commercial marketplace launch.

## What works

- **Neighborhood Connection:** an interactive first-screen preview links current catalog finds, their shop and an unexpired declared runner trip. Gift, food and locally made choices open the actual listing or give Sidekick its exact context. Previewing does not reserve stock, assign a runner or make a payment. [Design and verification](docs/neighborhood-connection.md).
- **Explore:** map discovery, searchable vendor storefronts, four featured finds and a paginated full catalog. Browsing remains available when the map cannot initialize. Paid sponsorship and premium subscriptions are not implemented.
- **Grounded assistant:** validated catalog searches, comparisons, availability, runner matching and authorized order-status reads. Preparing through the assistant produces a reviewable quote; it cannot confirm a payment or execute protected writes. Without an AI key, deterministic discovery remains available and labeled.
- **Orders:** shareable product pages offer quantity selection and a direct cart action; persistent vendor-grouped carts lead to explicit preparation, atomic stock reservations, payment choice and state-gated pickup/delivery/completion. [Customer flow and retest](docs/customer-order-path.md).
- **Private Demo Mode:** Customer, Vendor and Runner share one visitor's workspace. The profile bar identifies the current role, and each simulated order names the next role and action. **Simulate demo payment** enables the full walkthrough with explicit simulation labels, separate ledger evidence and no PayPal request. Stay in the same session when switching roles; leaving and re-entering creates a fresh workspace.
- **Vendor and runner tools:** searchable compact catalog editors, inventory management, quote inquiries/replies, expiring availability, trip intentions, matching and fulfillment controls.
- **Reputation:** completed-order vendor ratings, an earned community badge and private, noncash customer recognition. Simulated activity contributes only inside its private demo workspace; it does not manufacture public reputation.
- **Real account intake:** email-verification and customer-consent gates, vendor/runner applications, versioned consent, private PDFs, administrator review and retryable Resend notifications. These permissions cover Sandbox/demo participation.
- **Payment safeguards:** server-only Sandbox checkout/capture, signed webhooks, canonical amount/currency/order checks, idempotent ledger credit, reconciliation and guarded refunds. Simulation and genuine Sandbox payment records cannot be interchanged.

Three genuine marketplace Sandbox payments total **$44.00 USD**, each matched to a PAID order, completed webhook evidence and exactly one customer-payment ledger entry. This is separate from the hosted simulated walkthrough. See [Sandbox verification](docs/phase-4.3-sandbox-verification.md) and [simulation evidence](docs/evidence/demo-order-simulation-production-2026-10-27.json).

The latest [hardening review](docs/hardening-2026-10-27.md) describes the security/reliability fixes, regression evidence, operational limits and recommended next steps. GitHub Actions runs project and browser checks without production credentials.

The [demo delivery update](docs/demo-delivery-polish.md) adds map-failure recovery, a clearer three-role walkthrough and a warmer introduction. The judge story follows one $28 gift with an existing declared runner trip; genuine Sandbox verification is shown separately.

## Run locally

Use **Node.js 24** (`.nvmrc`) and **npm 11.9.0**. The application uses Next.js App Router, React, TypeScript, Supabase/PostgreSQL, MapLibre and Zod.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

The example starts at `http://localhost:3000`. With Supabase fields empty, browsing uses a fixed illustrative catalog; order previews do not persist, authenticate or charge. For connected development, use the dedicated [local backend](docs/local-backend.md), which runs real PostgreSQL, Supabase Auth and PostgREST:

```sh
npm run local:backend
# Keep this running in a separate terminal:
npm run local:gateway
# In another terminal:
npm run local:seed
npm run local:seed:phase3
npm run local:seed:phase4
npm run local:dev
```

Local wrappers select loopback credentials from ignored `.local-backend/` files and remove hosted payment, email and AI credentials. The reduced local stack has no Storage, SMTP or Realtime service. In a managed cloud workspace, use `npm ci --cache /workspace/.npm-cache` if the home cache is read-only. Node commands honor the inherited HTTPS proxy and system CA; never disable TLS verification.

## Environment settings

Use [.env.example](.env.example) as the checklist. Set `APP_URL` to the exact browser origin, such as `https://runners.aibrylabs.com`, and redeploy after changing Vercel settings. Cloud environment settings and Vercel settings are separate.

| Capability                                                                             | Variables                                                                                      |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Connected browsing, Auth and orders                                                    | `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`                  |
| Private demos, scoped runner reads, onboarding, privileged payments and administration | `SUPABASE_SERVICE_ROLE_KEY` (server only)                                                      |
| Genuine PayPal Sandbox checkout and signed webhooks                                    | `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`                                |
| Optional provider AI discovery                                                         | `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` (default `https://api.openai.com/v1`)                  |
| Application notification sending                                                       | `RESEND_API_KEY`, verified `ONBOARDING_EMAIL_FROM`; `ONBOARDING_EMAIL_TO=aibrymusic@gmail.com` |
| Scheduled notification retries                                                         | `CRON_SECRET`; daily Vercel Cron configuration is in [vercel.json](vercel.json)                |
| Optional signed Resend delivery events                                                 | `RESEND_WEBHOOK_SECRET`                                                                        |
| Optional demo entry/switch kill switch                                                 | `DEMO_MODE_ENABLED=false`; the database setting also revokes existing demo access              |
| Legacy local fixture seed only                                                         | `DEMO_SEED_PASSWORD` (at least 12 characters)                                                  |

Only the two `NEXT_PUBLIC_` values are public. Keep all secrets in secure environment settings, never in chat, Git, browser bundles or logs. `AI_MODEL` must name a model available to the selected provider account. Supabase Auth confirmation/recovery mail is configured in Supabase; Resend application notifications do not replace that setup. See [deployment and domain configuration](docs/deployment.md).

## Database and operations

A fresh database requires migrations **001–016 in order** from [supabase/migrations](supabase/migrations), then the relevant template/agreement seeds. Review and apply migrations through a controlled Supabase migration workflow. The existing hosted project has already received the community reputation and simulation upgrades; do not rerun initial setup or reset it. Additive operator SQL files in [docs/sql](docs/sql) are for their documented upgrade paths, not substitutes for a fresh-install migration history.

Seed/import/admin scripts use privileged credentials. Select the intended project before running them; routine deployment does not require reseeding or resetting production. Roles are approved server-side. Fictional vendors are labeled DEMO and never represented as verified businesses. See [database invariants](docs/database.md), [security controls](docs/security.md) and [vendor imports](docs/vendor-import.md).

## Verify changes

```sh
npm run check
npm run build
npm run test:e2e
```

`npm run check` runs formatting, ESLint, TypeScript and unit/database tests. The individual `format:check`, `lint`, `typecheck` and `test` scripts remain available. Unit/database tests execute real PostgreSQL semantics through PGlite, including RLS and nonprivileged roles. The offline browser suite isolates Supabase/payment/AI configuration and checks illustrative browsing. For persistent Auth, ordering and the three-role walkthrough, start and seed the local backend/gateway, then run:

```sh
npm run test:e2e:local
```

PDF verification requires `pdftotext` from Poppler (`sudo apt-get install poppler-utils` on Debian/Ubuntu). GitHub Actions installs it explicitly.

Browser suites build/start their own application and require port 3000 to be free. They use Chromium at `CHROMIUM_PATH` (default `/usr/bin/chromium`). Connected coverage includes desktop and 360/390/430px layouts. Local payment fixtures and simulated orders are labeled; these checks do not prove a new provider capture. Hosted integration evidence is recorded separately. Keep raw authenticated traces private.

## Project guide

| Need                                 | Start here                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rehearse or present                  | [Judge walkthrough](docs/hackathon-demo.md), [complete simulated order](docs/demo-order-walkthrough.md)                                                                  |
| Understand architecture and limits   | [Architecture](docs/architecture.md), [current validation](docs/build-notes.md)                                                                                          |
| Deploy or configure integrations     | [Deployment](docs/deployment.md), [PayPal](docs/paypal.md), [local backend](docs/local-backend.md)                                                                       |
| Understand trust and data rules      | [Security](docs/security.md), [threat model](docs/threat-model.md), [database](docs/database.md)                                                                         |
| Understand ratings and recognition   | [Community recognition](docs/community-recognition.md)                                                                                                                   |
| Inspect onboarding and notifications | [Onboarding implementation](docs/phase-4-implementation.md), [notification repair](docs/phase-4.1-hotfix.md), [production results](docs/phase-4.1-production-results.md) |

Dated phase reports preserve what was observed at the time; their older pending or unconfigured states are not current setup instructions. Road routing, real payouts, commercial approval, sponsored placement billing and automated retention/deletion processing remain future work. Keep the current Sandbox/demo boundary explicit in submissions and presentations.
