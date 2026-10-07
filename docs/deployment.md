# Deployment

1. Create or select a dedicated Supabase project. Apply migrations in order with the Supabase CLI and test its RLS/Auth behavior. Disable public role assignment. Configure Auth site URL and permitted redirect origins.
2. Configure a Vercel project pointed at this repository. Use the Next.js preset and Node.js 24. Install with `npm ci`, build with `npm run build`. No durable filesystem storage or persistent process is assumed by the application.
3. Set the public Supabase URL/key, server-only service key, PayPal Sandbox client/secret/webhook ID and the exact HTTPS `APP_URL`. Add optional AI model/base/key. Set values securely in the deployment dashboard, never in source.
4. Deploy to a review deployment. Register its PayPal Sandbox HTTPS webhook and update APP_URL accordingly. A production alias needs matching webhook/Auth configuration.
5. Run the signature scenario using Sandbox buyer/merchant accounts. Verify server payment confirmation, idempotent webhook replay, inventory, each role's authorization, completion rewards and ledger/audit state.
6. Review security and remaining hardening before publishing as a real marketplace.

Required egress: your `<project>.supabase.co`, `api-m.sandbox.paypal.com`, configured AI provider, `tile.openstreetmap.org`, Google Fonts hosts if external fonts remain enabled. Map attribution must remain visible. For a production/high-traffic map use a licensed tile provider and update CSP/egress; OpenStreetMap public tiles are not an unlimited commercial SLA.

The onboarding draft stores install/start instructions and domain requirements. Saving that draft does not publish or execute it. Review and save changes in environment settings, then publish the environment through the product when ready. No Vercel project was created, no external deployment was issued and no publication is claimed by local checks.

For the Phase 2 upgrade, apply migrations 008 and 009 to the existing Supabase project **before** deploying the committed application changes. Do not rerun the initial setup SQL. Confirm `phase2_payment_ready` exists, that browser roles cannot call payment attachment RPCs, and that Production uses `AI_MODEL=gpt-4.1-mini` if using the configured OpenAI key. This audit did not push Phase 2 to main or publish a deployment while hosted migration readiness remains unconfirmed.
