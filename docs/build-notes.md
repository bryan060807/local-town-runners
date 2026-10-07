# Implementation and validation

Built the initially empty repository into a Next.js marketplace with map discovery, deterministic demo data, a validated AI tool registry, public profiles, authenticated role dashboards, persistent orders, runner trips, inventory reservations, private addresses, moderation and rewards. Seven SQL migrations define RLS, state transitions, financial events and sanitized asset metadata/storage rules. PayPal Sandbox checkout, capture and verified webhook routes are implemented; they have not been exercised with live credentials.

Verified production builds, TypeScript and ESLint; 27 unit/PostgreSQL integration tests; eight desktop/mobile marketplace browser tests including real map tiles and worker loading. Real local PostgreSQL/Auth/PostgREST smoke and browser checks cover sign-in, signup, persistent draft preparation, cancellation, inventory and role restrictions. No payment is marked successful in these local checks.

Map tiles use a bounded, fixed-host HTTPS proxy with system trust and caching. Fonts and the map worker are self-hosted. Screenshots are in `docs/screenshots/`.

The selected project URL is `https://hmmabjvxahomvsgxffju.supabase.co`. Hosted credentials, PayPal Sandbox credentials/webhook ID, optional AI credentials and deployment access are still required. Hosted migrations, Storage, real Sandbox capture/webhook delivery, provider AI and deployment have not been validated. Real-time subscriptions, road routing, multi-item carts, refunds/reconciliation, real payouts and reward partners remain outside the implemented MVP.

Cloud install/start instructions and credential requirements are saved as a configuration draft. Draft saving does not publish the environment or deploy the application. See `local-backend.md` for the tested development backend and `deployment.md` for hosted integration steps.
