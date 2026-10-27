# Explore and community recognition

Explore introduces local vendors before showing a small product selection. It shows up to six vendor cards, a native scrolling vendor rail on phones, and four featured finds sampled across available vendors. **Browse all items** opens the complete filtered catalog in pages of twelve. Search also finds vendors with no current inventory, so their storefront remains discoverable.

Featured finds currently use the available catalog without paid ranking. Subscription billing and sponsored placements are future features; earned reputation is independent of promotion.

## Vendor ratings

- Only paid orders with a recorded capture, matching payment ledger entry, and completion evidence contribute.
- A customer can review an order once. Vendor self-purchases do not contribute.
- Public storefronts show the average, completed-order review count and fulfilled-order count. Review text and customer identities stay out of the public aggregate.
- **Community favorite** requires at least five distinct reviewing customers and an average of 4.5 or higher.
- A later refund retains the completed-order review, including a negative rating.
- A new vendor shows **No completed-order reviews yet**. Missing reputation data shows an unavailable state rather than invented stars.

## Private customer recognition

Each eligible completed purchase contributes **10 community points**. Its review adds **5 points** when the trimmed comment has at least twenty characters. One-star and five-star reviews earn the same credit. Refreshing, retrying or revisiting an order cannot award additional points because totals derive from the existing unique order and review records.

Purchase milestones are **First local purchase** at one, **Regular neighbor** at five, and **Community supporter** at ten. These are private recognition milestones with no cash value, discount, payout or transferable balance. Runner reward counters retain their existing behavior.

The dashboard includes buying and selling habits: keep payments and status updates in the app, maintain accurate inventory, confirm receipt before completion, protect operational addresses and use the report/refund/support flows when needed. Recognition describes recorded activity; it is not a safety certification.

## Explicit private demo orders

The [demo order walkthrough](demo-order-walkthrough.md) can simulate payment inside the current private workspace. These orders use a separate simulated ledger entry and never acquire PayPal payment IDs. Their completions and reviews contribute only to that workspace's clearly labeled demo recognition; genuine public vendor reputation and captured-payment totals remain separate.

## Setup and boundaries

Apply [the operator SQL](sql/community-reputation-upgrade.sql) once in the existing Supabase project's SQL Editor. It is identical to migration `015_community_reputation.sql`, can be retried, and adds indexes and read-only aggregate functions. It does not change existing orders, payment ledger rows, review rows or runner reward counters.

Public aggregates use the same authenticated cookie context and vendor visibility rules as the catalog. Customer progress uses `auth.uid()` without a caller-supplied user ID. Real records, the public template and private demo workspaces retain their existing isolation. Demo recognition is labeled separately; no positive ratings or completed purchases are seeded to manufacture reputation.

Local browser evidence uses an explicitly local payment fixture. It is not evidence of a new PayPal capture. No additional Sandbox transaction, Live payment, subscription charge or real payout is initiated by these acceptance checks.

## Validation

ESLint, TypeScript, production build, 83 unit/database tests and 48 browser scenarios passed. The browser matrix covers desktop and 360/390/430px widths, including a one-star review earning the same recognition, duplicate rejection, private/public aggregate separation, all catalog items remaining reachable and keyboard navigation through the mobile vendor rail. See [sanitized results](evidence/explore-reputation-2026-10-27.json) and the [local screenshots](screenshots/explore-reputation-2026-10-27/desktop-vendor-directory.png).

Production source `4e30b08e276e4be8ff31d82bd9aea1ac5652eb27` is READY on `runners.aibrylabs.com`, with the new SQL active. Fresh production demo checks confirmed four vendors, four featured finds, honest zero-review states and private zero-point progress on desktop and 360px. There were no page errors, transport failures or page overflow. These checks created no orders, reviews or payments. See [live evidence](evidence/explore-reputation-production-2026-10-27.json) and the [live mobile screenshot](screenshots/explore-reputation-2026-10-27/LIVE-PRODUCTION-mobile-360-explore-vendors-and-featured.png).
