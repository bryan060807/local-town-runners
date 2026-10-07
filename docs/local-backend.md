# Local backend

This environment has a real PostgreSQL 17, Supabase Auth (GoTrue), and PostgREST development backend. It supports persistent authentication, RLS and orders. It excludes Storage, Realtime and hosted payment services. A full Supabase CLI stack exceeded this environment’s disk capacity; the smaller stack is explicit rather than a mock.

From the repository, run `npm run local:backend`, then keep `npm run local:gateway` running in a separate terminal. Run `npm run local:seed`, then `npm run local:dev`. The backend initializer reuses only its named containers and applies new migrations. Seeding is repeatable and preserves existing inventory. Generated development credentials live in ignored, restricted `.local-backend/` files; never copy them to production.

Run `npm run test:local` for real Auth/PostgREST smoke checks and `npm run test:e2e:local` for browser authentication, persistent draft ordering, cancellation and role dashboards. Stop an existing app before browser tests, which manage their own app process.

The dedicated Docker containers are `ltr-local-db`, `ltr-local-auth` and `ltr-local-rest`. A destructive local reset requires stopping these containers and removing only these named containers with their anonymous volumes, then rerunning initialization and seeding. It deletes local demo orders and accounts. Do not run this against a hosted project. `supabase db reset` applies only to a separate full Supabase CLI stack and does not reset this reduced stack.

For the selected hosted project, configure the public key and server service-role key in environment settings, review migrations, and apply them using the deployment guide. Hosted Auth, Storage, PayPal Sandbox and provider AI must be checked separately before deployment.
