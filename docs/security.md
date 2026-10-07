# Security

Server Auth calls `getUser()` to validate the token with Supabase Auth; it does not trust a browser role or unverified session claims. Proxy middleware propagates refreshed cookies with `getAll`/`setAll`. New accounts receive only customer membership. Vendor/runner/admin provisioning requires administrator-controlled database/service credentials.

Protected writes require an exact configured Origin and strict schemas. Cookie authentication plus this check blocks cross-origin form/JSON writes. RLS and column grants also apply if callers bypass Next routes. Payment confirmation is never exposed as a client-writable table or RPC. Auth endpoints rely on Supabase Auth's built-in rate controls; authenticated sensitive actions also use shared PostgreSQL minute-window limits.

React escapes descriptions and model-generated search output. No user HTML or arbitrary model text is injected. CSP prevents framing and restricts destinations/workers; development-only eval permits React debugging. Production uses inline script permission for Next hydration, not a nonce-based strict CSP yet. Uploads accept bounded PNG/JPEG/WebP raster files, verify decoding and pixel limits, resize and strip EXIF/GPS metadata, and require ownership. Storage writes use a dedicated service-side route; client bucket writes are denied. Hosted Storage integration remains unverified.

AI can choose validated catalog queries, approximate matching, comparisons, authorized order reads and review quotes. It cannot select arbitrary SQL, credentials, user roles, payment states or protected write tools. Output prices/inventory are synthesized from catalog rows and all returned IDs are selected from those rows.

PayPal verification uses the official signature verification API, then canonical order data and matching custom ID/amount/currency. Certificate URLs are restricted to PayPal HTTPS hosts. Missing signature headers fail before external requests. Verified event IDs and capture IDs are idempotent. The webhook is excluded from same-origin checks because PayPal is a third-party sender. It still validates signatures and bounds request size.

Secrets stay in server-only modules and deployment settings. Logs include error class/event names, never request bodies, tokens, addresses or GPS. Service role credentials are used only for financial confirmation, seed/import, sanitized uploads and administration. See the threat model for remaining production hardening.
