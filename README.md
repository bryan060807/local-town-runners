# Local Town Runners

Discover local goods and coordinate pickups with a neighbor already going that way. Local Town Runners is a hackathon marketplace centered on Louisiana, Missouri, with catalog-grounded AI discovery, vendor storefronts and a complete customer → vendor → runner workflow.

**[Try the app](https://runners.aibrylabs.com) · [Judge walkthrough](docs/hackathon-demo.md) · [Published Devpost entry](https://devpost.com/software/paypal-proofpay) · [Submitted video](https://youtu.be/3_TTpw0K51g) · [Submission checklist](docs/submission-checklist.md)**

**JUDGE READY — owner sign-off, November 11, 2026.** The Devpost entry was submitted November 4 and includes the hosted app, public source, and YouTube video. The owner has approved the finished video and reports multiple successful complete customer/vendor/runner demonstrations. This is an operator acceptance statement, not an independent re-inspection of the video's runtime, visibility, or contents. The current hosted source, historical automated tests, and Sandbox ledger are separately documented below.

The showcase combines participating local vendor storefronts with fictional private Demo Mode workspaces and PayPal **Sandbox**. Vendor, runner and platform allocations are simulated; no actual payout is sent. Real-vendor previews are for browsing; fictional workspaces handle the role-switching order walkthrough. It is not a commercial marketplace launch.

## What works

- **Neighborhood Connection:** an interactive first-screen preview links current catalog finds, their shop and an unexpired declared runner trip. Gift, food and locally made choices open the actual listing or give Sidekick its exact context. Previewing does not reserve stock, assign a runner or make a payment. [Design and verification](docs/neighborhood-connection.md).
- **Explore:** map discovery, searchable vendor storefronts with product thumbnails, four featured finds and a paginated full catalog. Product pages preserve full portrait photos in a bounded frame, with details alongside on desktop. Browsing remains available when the map cannot initialize. Paid sponsorship and premium subscriptions are not implemented. [Vendor presentation](docs/vendor-presentation.md).
- **One local Sidekick:** a single panel offers **Plan an errand** for model-first multi-item comparisons, budgets, clarifications and revisions, and **Find & ask** for quick discovery and authorized order reads. Switching tools keeps their drafts and results. The server rechecks plan choices against fresh catalog prices, stock and pickup facts before explicit review and cart saving. **Show on map** highlights the plan's shops; the full-width map and item previews link back to the same Sidekick. Actual model answers and catalog fallbacks are labeled separately. [AI workflow and verification](docs/sidekick-errand-planner.md).
- **Orders:** shareable product pages offer quantity selection and a direct cart action; persistent vendor-grouped carts lead to explicit preparation, atomic stock reservations, payment choice and state-gated pickup/delivery/completion. [Customer flow and retest](docs/customer-order-path.md).
- **Private Demo Mode:** Customer, Vendor and Runner share one visitor's workspace. The profile bar identifies the current role, and each simulated order names the next role and action. **Simulate demo payment** enables the full walkthrough with explicit simulation labels, separate ledger evidence and no PayPal request. Stay in the same session when switching roles; leaving and re-entering creates a fresh workspace.
- **Participating local businesses:** a separate read-only section inside Demo Mode previews published real vendors and up to three public listings each. Expand their cards below Sidekick; demo shopping and AI continue to use the fictional catalog. Published profiles refresh on the next homepage read. [Showcase guide](docs/demo-vendor-showcase.md).
- **Vendor and runner tools:** searchable compact catalog editors, inventory management, quote inquiries/replies, expiring availability, trip intentions, matching and fulfillment controls.
- **Reputation:** completed-order vendor ratings, an earned community badge and private, noncash customer recognition. Simulated activity contributes only inside its private demo workspace; it does not manufacture public reputation.
- **Real account intake:** email-verification and customer-consent gates, vendor/runner applications, versioned consent, private PDFs, administrator review and retryable Resend notifications. These permissions cover Sandbox/demo participation.
- **Payment safeguards:** server-only Sandbox checkout/capture, signed webhooks, canonical amount/currency/order checks, idempotent ledger credit, reconciliation and guarded refunds. Simulation and genuine Sandbox payment records cannot be interchanged.

Three genuine marketplace Sandbox payments total **$44.00 USD**, each matched to a PAID order, completed webhook evidence and exactly one customer-payment ledger entry. This is separate from the hosted simulated walkthrough. See [Sandbox verification](docs/phase-4.3-sandbox-verification.md) and [simulation evidence](docs/evidence/demo-order-simulation-production-2026-10-27.json).

The [October 27 hardening review](docs/hardening-2026-10-27.md) describes security and reliability fixes. The later [November 2 Sidekick verification](docs/sidekick-errand-planner.md) records passing exact-source CI: 146 unit/database tests and 176 browser checks (48 offline, 128 connected). Its dependency audit reported 16 moderate advisories while passing the high-severity gate; do not confuse this with earlier zero-advisory reports. GitHub Actions runs without production credentials.

The [demo delivery update](docs/demo-delivery-polish.md) adds map-failure recovery, a clearer three-role walkthrough and a warmer introduction. The current [judge story](docs/hackathon-demo.md) follows Sidekick comparing bakery combinations, revising the choice to two cinnamon rolls for **$9.00**, and carrying that choice through a completed simulated delivery. Set the fictional runner's declared trip to Demo Hearth Bakery before recording; genuine Sandbox verification is shown separately.

## Judge access and submission materials

Open the hosted app and choose **Enter Demo Mode**. The hosted walkthrough requires no personal account, API key or payment. Keep the same browser session and use **Switch demo profile** to follow Customer, Vendor and Runner through the same private workspace. The [judge guide](docs/hackathon-demo.md) gives the preparation, exact prompts and full fulfillment sequence. Genuine PayPal Sandbox proof is documented separately from this simulated order.

For real local participation, expand a card in **Participating local businesses** below Sidekick on the demo homepage. This displays current public information without shopping, reserving stock or acting as the real vendor. See [the showcase guide](docs/demo-vendor-showcase.md).

The [submission checklist](docs/submission-checklist.md) records the completed ISC license, submission status, remaining independent-access checks and screenshot provenance guidance. Its screenshot order follows the current $9 bakery story. Existing [actual hosted AI screenshots](docs/screenshots/sidekick-planner/README.md) can support the submission with their original provenance; localhost mocked-provider images are test evidence.

The [final delivery plan](docs/final-submission-plan.md) preserves the earlier schedule and now records November 11 operator sign-off. The [original written entry draft](docs/hackathon-submission-draft.md) is historical preparation copy; the [published Devpost entry](https://devpost.com/software/paypal-proofpay) is authoritative and was submitted November 4. The finished [YouTube video](https://youtu.be/3_TTpw0K51g) is linked in that published entry.

The earliest visible MVP commit was made **October 6, 2026 (Central)**. Subsequent work added onboarding, payment recovery and completed Sandbox verification, private simulated fulfillment, community recognition, neighborhood discovery and actual model-backed errand planning. October 30 improved real-vendor presentation; November 2 added a read-only real-business showcase inside Demo Mode and consolidated planning/discovery into one Sidekick panel with a full-width map. The Git history and dated implementation reports document development within the competition period.

The operator has approved the submitted video and repeatedly completed the full hosted demo. The audit has not independently measured the video's duration or tested signed-out YouTube viewing. The official submission cutoff is **November 12, 2026, 2:00 p.m. Central**; organizers instruct entrants to avoid further repository/video edits after that cutoff and keep the hosted app, Demo Mode and AI/provider capacity available through the **December 21, 2026** winners announcement. The formal judging window ends December 15.

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

| Need                                 | Start here                                                                                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rehearse or present                  | [Judge walkthrough](docs/hackathon-demo.md), [screenshots and submission checklist](docs/submission-checklist.md), [complete simulated order](docs/demo-order-walkthrough.md) |
| Understand architecture and limits   | [Architecture](docs/architecture.md), [current validation](docs/build-notes.md)                                                                                               |
| Deploy or configure integrations     | [Deployment](docs/deployment.md), [PayPal](docs/paypal.md), [local backend](docs/local-backend.md)                                                                            |
| Understand trust and data rules      | [Security](docs/security.md), [threat model](docs/threat-model.md), [database](docs/database.md)                                                                              |
| Understand ratings and recognition   | [Community recognition](docs/community-recognition.md)                                                                                                                        |
| Inspect onboarding and notifications | [Onboarding implementation](docs/phase-4-implementation.md), [notification repair](docs/phase-4.1-hotfix.md), [production results](docs/phase-4.1-production-results.md)      |

Dated phase reports preserve what was observed at the time; their older pending or unconfigured states are not current setup instructions. Road routing, real payouts, commercial approval, sponsored placement billing and automated retention/deletion processing remain future work. Keep the current Sandbox/demo boundary explicit in submissions and presentations.
