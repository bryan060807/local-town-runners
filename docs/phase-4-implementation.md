# Phase 4 implementation and operations

Phase 4 extends the existing Next.js/Supabase application. Phase 3 demo workspaces and PayPal Sandbox restrictions are retained. This release is **implemented**; deployment, provider acceptance and live workflows require separately recorded evidence.

## Accounts and authorization

New Auth identities receive pending customer membership. Supabase-confirmed email and versioned customer Terms/Privacy acceptance activate customer ordering. Auth identity/session and application approval are separate. Customer, vendor, runner and administrator memberships are normalized in `user_roles`; membership status is not user-editable. Existing Auth confirmation is read from its actual confirmation timestamp. Existing real customers also need the new Terms/Privacy acceptance before ordering; no historic consent or email verification is invented. Isolated Phase 3 demo sessions retain their fictional role access. No new real vendor identities are seeded.

`/account` supports private addresses, delivery instructions, communication and optional analytics preferences, session sign-out and deletion requests. Deletion suspends access and records a review request; it does not delete financial/consent history. The operator must reconcile retention obligations, remove unnecessary private information, and complete Auth deletion only when references/retention permit. Do not cascade-delete accounts with transaction or consent records.

`/vendor/apply` and `/runner/apply` save private drafts. Submission locks the application content and creates immutable consent plus document and notification records atomically. Terminal applications may be followed by a new application revision; original evidence remains. Administrator approval requires verified email and a completed private PDF. Approval/rejection is idempotent and auditable. Old browser role assignment cannot grant real vendor/runner/admin privileges. Public real vendor participation remains Sandbox/demo permission only, with insurance, licensing and background checks unverified. Initial photos stay private until approval. After approval the server promotes only that application’s permitted product photos to the existing public asset bucket and attaches them to the approved listings. Publication failures are reported as pending and can be retried without reversing approval or deleting consent. Approved vendors can also explicitly publish permitted images using existing catalog upload controls.

Runner preferences include service/travel/pickup areas, transportation, availability windows, accepted categories, radius and maximum detour. Reviewed categories/detour initialize the existing runner profile; availability/trip sharing must still be explicitly activated by the runner. Public name defaults to “Neighbor runner.” No continuous tracking or identity-document collection is introduced. Existing assignment-scoped delivery-address visibility stops after assignment completion. Public trip notes must not include precise private routes.

## Agreements and PDFs

`docs/agreements/VDPCP-original-blank.pdf` is the blank source provided by the user. `vdpcp-2026-10-08.json` preserves all twelve substantive sections with PDF wrapping normalized; the source checksum identifies the supplied PDF. The agreement authorizes demonstration/development/Sandbox use, **not a commercial vendor relationship**. It neither promises fulfillment nor real payouts. Future commercial participation needs separate terms; do not silently extend this consent.

Customer Terms/Privacy and the ten-section runner participation agreement have explicit versions in `src/lib/onboarding/definitions.ts`. Review these policy versions with the platform operator before inviting real applicants. All signed records retain exact accepted sections, source SHA256, authenticated identity, verified-email snapshot, typed name, signature strokes, explicit affirmative consent, acknowledgments and database timestamp. Corrections/new agreements produce new records. The project-representative fields in the original blank VDPCP are not automatically signed or forged by this workflow.

The touchscreen/mouse/keyboard signature pad stores bounded vector strokes. These are electronic signature evidence, not certified cryptographic digital signatures. PDFs include the agreement body, complete submitted information, acceptance metadata and drawn signature. The bundled DejaVu Unicode font preserves source punctuation and supports portable server rendering. The font license is included.

The `onboarding-private` bucket accepts only generated PDF and sanitized WebP. Browser Storage read/write/list operations are blocked by restrictive policies even alongside existing permissive policies. Server routes authorize the owning real user or platform administrator via database RLS before issuing 60-second signed URLs. Paths and document hashes become immutable after successful generation. Failed generation retains consent and can be retried. Object creation never overwrites an existing completed PDF.

## Administration

`/admin/onboarding` requires a real, active platform administrator on the server and database. It displays application states, private details/documents/photos, timestamps, internal decision notes, audit history, notification status and customer lifecycle. Search and status filtering are available; lists are bounded to 100 records. Use the Supabase operator workflow for larger-volume pagination until an expanded dashboard is implemented.

### Bootstrap

1. Register the intended administrator through normal Auth and verify their email.
2. Find the UUID in Supabase Authentication (do not identify an admin by editable metadata).
3. From an authorized service environment run:

```sh
node --use-env-proxy --use-system-ca --import tsx scripts/bootstrap-admin.ts AUTH_USER_UUID
```

The script requires a verified, active, non-demo identity and writes an audited administrator membership. This is an operator-only action. Do not place the service key in the browser. Later operators can revoke a membership directly through the controlled database administration workflow. Browser application review never grants administrator membership.

### Review

Open the application, read its complete consent PDF and submitted information, and record an internal review note. “Start review” moves to `under_review`; “Approve application” grants only the reviewed role and initializes the approved catalog/profile. “Reject application” retains the original record. Suspension blocks marketplace access; it is not deletion. Do not restore an account with a pending deletion request until the retention/deletion workflow is resolved.

## Environment and email

Required existing Supabase/Auth/APP_URL variables remain unchanged. Add server-only `RESEND_API_KEY` and `ONBOARDING_EMAIL_FROM`, e.g. `Local Town Runners <onboarding@aibrylabs.com>`. Verify that sender domain in Resend using its exact Cloudflare DNS records. The administrator recipient is fixed to `aibrymusic@gmail.com`; browser input cannot redirect notifications. Configure the same settings in Vercel Production and authorized cloud environment settings. Never paste a key into chat or Git.

Notifications contain identifiers and an authenticated admin review link, not sensitive signatures or public document URLs. PDF downloads occur only after administrator sign-in. A persisted notification queue survives email/PDF failures. Claims serialize concurrent sends with a lease and a stable Resend idempotency key. Transient failures back off and can be retried from the review dashboard. “accepted” requires a provider receipt; it is not proof of inbox delivery. Resend deduplication expires after 24 hours; uncertain attempts older than 23 hours are blocked for operator reconciliation rather than blindly resent. Accepted messages are never resent by retry. This phase uses operator-triggered retries; no automatic scheduled worker is configured.

Supabase Auth email delivery is separate from application notifications. In Supabase Authentication:

- Enable email confirmations; the local test stack intentionally uses automatic confirmation only for browser fixtures.
- Set Site URL to `https://runners.aibrylabs.com` and allow the exact `/auth/callback` recovery/verification redirect URLs for approved deployment origins.
- Configure a supported SMTP sender (Resend supports SMTP) for real verification/recovery delivery and rate limits.
- Use token-hash templates linking to `/auth/confirm?token_hash={{ .TokenHash }}&type=signup` and `type=recovery`, or the PKCE callback flow. Do not use fragment tokens with the HttpOnly server session architecture.

Resend MCP registration is optional tooling and does not configure the deployed app's API key or sender. The requested `codex mcp add resend --url https://mcp.resend.com/mcp` failed in this cloud because Codex's configuration mount is read-only; run it in a writable local Codex installation.

## Deployment and rollback

Apply `docs/sql/phase-4-upgrade.sql` once in the hosted Phase 3 database. It is additive and does not reset existing data/demo sessions. It refuses reuse of a public consent bucket. Then run `npm run seed:phase4` using the existing hosted service binding. The seed publishes agreement definitions only, never real applicants or prospective vendors. Bootstrap the administrator, configure email and verify Storage before inviting applicants.

Release tested code to a separate feature branch first. Deploy through the existing GitHub `main` → Vercel pipeline only after the schema is ready. Keep `APP_URL=https://runners.aibrylabs.com` and Sandbox payment credentials. No live payment endpoint or payout provider is enabled.

Rollback application code by redeploying the prior working build; keep the additive schema and evidence. The new verification/approval gates remain at the database boundary. Do not drop tables, strip policies or restore overwritten production data. Pause intake by deactivating an agreement version; already accepted evidence remains accessible. Do not delete consent or notification history to “reset” a failed workflow.

## Release gates

Record real email confirmation/recovery, private PDF upload/download authorization, admin approval, Resend provider receipt and mailbox delivery, and demo regression results separately. A Sandbox buyer must approve a real checkout before provider capture/webhook reconciliation can be verified. Redirects, simulator events, OAuth configuration and LOCAL-TEST capture fixtures are not evidence of a completed Sandbox checkout. Vendor/runner payouts remain simulated and zero actually transferred.
