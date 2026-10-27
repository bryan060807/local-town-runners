# Deployment and integration operations

Production is **https://runners.aibrylabs.com**, deployed from `main` through Vercel. The current product supports fictional demonstrations and genuine **PayPal Sandbox** testing. Live payments and actual vendor/runner payouts are not enabled. See the [README](../README.md) for the current feature and environment checklist; dated phase reports preserve earlier states rather than current deployment instructions.

## Build and release

1. Review the change and run lint, type checking, unit/database tests, production build and relevant browser acceptance. The persistent browser suite requires the dedicated local backend and gateway. Keep raw authentication traces and environment files out of Git.
2. If a change includes schema, review and test its additive migration first. A fresh project needs migrations **001–016 in order**; the existing project already has the reputation and simulation upgrades. Do not reapply initial setup, reset production or reseed as part of an ordinary release. Use the project's controlled migration history; manual additive SQL upgrades must be accounted for before using `supabase db push`.
3. In Vercel, select this repository, the **Next.js** preset, root `./`, **Node.js 24.x**, install `npm ci` and build `npm run build`. Leave the output directory at the framework default. The app requires no durable local disk or persistent process.
4. Configure variables for the intended deployment environment. Vercel Production, Preview and the Codex cloud workspace have separate settings. Never expose the service key or integration secrets as `NEXT_PUBLIC_` variables.
5. Push the reviewed source to `main`. Confirm the resulting production deployment is READY, its Git SHA matches the intended release and the production alias points to that deployment. An old deployment remains unchanged when environment settings are edited; redeploy to apply them.
6. Check public browsing, protected-page denial and a fresh private simulated walkthrough. Recheck preserved payment evidence read-only when payment code changes. A new genuine Sandbox payment requires explicit operator authorization and buyer approval; a successful build or redirect does not prove capture.

## Domains and Auth

Add **`runners.aibrylabs.com`** to the Vercel project when that is the intended app address. Manage its DNS at Cloudflare using the exact record target Vercel provides, and wait for Vercel to confirm domain and HTTPS readiness. The root `aibrylabs.com` is a separate domain choice.

Set **`APP_URL=https://runners.aibrylabs.com`** with no extra path. Cookie-authenticated writes require the configured exact origin. Redirect an alternate alias to the canonical domain before users interact; writing from a different alias is intentionally rejected.

In Supabase Auth, configure the canonical site URL and permitted application callback/confirmation redirects, including `/auth/callback` and `/auth/confirm` as used by the chosen email templates. Configure and test Auth email confirmation, recovery and SMTP separately from application notifications. Real ordering requires confirmed email and current customer consent; vendor/runner approval is a separate administrator decision. Do not add production-wide wildcard redirects merely to make a preview work.

For previews, set `APP_URL` to that preview's intended origin and use dedicated test integration configuration. Do not move the production PayPal webhook or reuse a real operator's account as a test fixture.

## Integration settings

| Capability        | Configuration and check                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase          | Public project URL/publishable key; server-only service role key; reviewed migrations and RLS; private onboarding bucket and public sanitized-asset bucket. Test Auth and Storage separately.                                                                                                                                                              |
| Private Demo Mode | Seed the fictional template for a new project using the reviewed operator workflow. No new key is needed for simulated payment. Six-hour tickets isolate visitors; switching roles retains the workspace. Exiting and re-entering starts fresh.                                                                                                            |
| Sandbox payments  | Client ID, client secret and webhook ID from the **same Sandbox REST app**. The API base is fixed to Sandbox. Register `https://runners.aibrylabs.com/api/webhooks/paypal` for the supported capture events; see [PayPal setup](paypal.md). Verify canonical merchant capture, amount, currency, custom ID, signed webhook and exactly-once ledger credit. |
| AI discovery      | Optional `AI_API_KEY`, `AI_MODEL` and HTTPS `AI_BASE_URL` (default `https://api.openai.com/v1`). Select an available model for that account. The assistant has no protected write or payment-confirmation tool.                                                                                                                                            |
| Application email | `RESEND_API_KEY`, verified `ONBOARDING_EMAIL_FROM`, and fixed `ONBOARDING_EMAIL_TO=aibrymusic@gmail.com`. A receipt proves provider acceptance; inbox receipt or an authenticated delivery event is separate evidence.                                                                                                                                     |
| Retry worker      | `CRON_SECRET` in Vercel; [vercel.json](../vercel.json) schedules `/api/internal/notifications` daily at 12:00 UTC. It processes at most five due auto-dispatch jobs per invocation, below five attempts. Historical manual-only jobs remain manual. Monitor backlog and blocked jobs.                                                                      |
| Delivery events   | Optional `RESEND_WEBHOOK_SECRET` plus a matching Resend endpoint at `/api/webhooks/resend`. Without it, send acceptance can work, but automatic delivery/bounce status is unavailable.                                                                                                                                                                     |

`ONBOARDING_EMAIL_FROM` is the sender variable; `ONBOARDING_EMAIL_FORM` is not used. `VERCEL_TOKEN` is optional operator tooling access and is not required by the deployed application. Keep it out of browser-facing variables.

## Operations and rollback

Review provider failures, payment recovery observations, notification queues and administrator audit events. Logs intentionally omit provider payloads, credentials, exact addresses and application content. A quiet live log stream does not establish that historical requests succeeded.

Roll back application code by redeploying the last working build. Preserve additive schema, immutable agreements, payment records and audit evidence. Do not restore an old database snapshot to undo a display defect or expire/reassign demo identities to reveal old orders. The real administrator can inspect retained history outside Demo Mode.

The current tests cover application and database behavior; they do not establish capacity, uptime, disaster recovery or a commercial compliance program. Before broader use, document backup/restore tests, retention/deletion handling, alert ownership and provider limits. Demo workspaces, rate-limit records and operational data need a deliberate retention policy; expiry restricts access but does not erase financial history.

Required server egress includes the selected Supabase project, `api-m.sandbox.paypal.com`, `api.resend.com`, the configured AI provider and `tile.openstreetmap.org`. Fonts and the map worker are self-hosted. Keep attribution visible; the public OpenStreetMap tile service is not an unlimited commercial SLA. Select an appropriate tile provider before sustained public traffic and update configuration/CSP accordingly.
