# Local Town Runners — short hackathon walkthrough

Goal: show a grounded discovery experience, a real persisted marketplace workflow and honest payment evidence without depending on another PayPal approval during judging.

## Three-minute story

**0:00–0:35 — The problem and discovery.** Open https://runners.aibrylabs.com and enter Demo Mode as Alex Carter. Explain: “Local goods can be hard to discover, and delivery does not always need a dedicated trip. We connect available inventory with a neighbor already going that way.” Ask **“I would like a mug for my desk, maximum $30.”** Show the actual catalog item and price. Follow with **“Tell me more about it.”** Use the map and optional approximate-location control. Make no precise GPS, route-time or guaranteed-delivery claim.

**0:35–1:10 — Review before action.** Ask **“Get me two.”** Show the reviewable quote; it does not reserve inventory or charge. Open the product, adjust quantity, add to cart and prepare a vendor order. Show the persisted DRAFT and explicit payment button. A quote, a reservation and a verified payment are separate steps. Do not initiate another Sandbox transaction just to finish the pitch.

**1:10–1:45 — Payment proof.** Use the existing Phase 4.3 evidence: $4.50 USD, canonical merchant capture `17M125027B131373Y`, marketplace order `29945be0-236d-4a80-845a-36cf43b4fb1a`, PAID, one customer-payment entry and matching completed webhook. The administrator can view it through their own real account outside Demo Mode. Do not share an administrator password or claim that a fresh demo inherits that order. The three actual marketplace Sandbox tests total $44.00 with one payment entry each.

**1:45–2:35 — Neighbor fulfillment.** On your fresh draft, choose **Simulate demo payment** and show **SIMULATED DEMO ORDER — NO PAYPAL CHARGE**. Switch Vendor → Accept demo order → Find a runner. Switch Runner → availability/trip intention → Accept run. Show that the exact fictional delivery address becomes available only after assignment. Vendor marks ready; Runner confirms pickup, delivery and delivered; Customer confirms completion and can leave a review. Show one completed run and ten demo reward points. Actual vendor/runner payouts stay $0.00. Use the [full simulation walkthrough](demo-order-walkthrough.md) for rehearsal; a labeled recording is a fallback if time is short.

**2:35–3:00 — Close with execution.** Show the mobile search and cart, or the quote request/vendor reply flow. Summarize the controls: catalog-grounded tools, explicit approval, state-gated fulfillment, account/workspace isolation, signed payment verification and exactly-once payment credit. State that the current product uses fictional vendors and PayPal Sandbox; commercial onboarding and real payouts are not enabled.

## Judge self-service path

Enter Demo Mode and use the same browser throughout. Search/filter the catalog, use the assistant, open a listing and prepare a cart. Switch Customer/Vendor/Runner with the profile selector; quote inquiries and vendor responses work without payment. Catalog changes persist in the same isolated workspace. Exit and re-enter to start a fresh workspace; that does not erase old payment history.

Explore now starts with vendor storefront cards and four featured finds. On phones, swipe the vendor cards horizontally; **Browse all items** opens the full catalog in pages of twelve. Fresh demo storefronts honestly show no completed-order reviews, and fresh customers start with zero community points.

The recorded local fulfillment walkthrough also shows a completed purchase earning ten points, followed by a detailed one-star review earning five more. The storefront displays the actual one-star aggregate; the customer's points remain private. Keep these screenshots captioned as local fixtures. [Community recognition rules and setup](community-recognition.md) explain the milestones and earned vendor badge.

In the Vendor dashboard, **Your catalog** shows ten compact item rows per page. Search by item name, filter by category, storefront or listing status, and sort by name, price or stock. Select an item name to expand its editor, then save. The row updates immediately; closing or filtering an item keeps its unsaved price and stock edits until the page is reloaded.

Judges can prepare a draft and choose **Simulate demo payment** to follow the entire hosted workflow without a PayPal buyer. All three profiles share that visitor's private demo workspace. The separate PayPal Sandbox option still requires explicit buyer approval and provider verification. An existing PayPal attempt cannot be converted to a simulation; prepare a new draft instead.

## Ready-to-present checklist

- Use the deployed URL and a fresh demo ticket in one browser.
- Keep genuine Sandbox payment evidence and the simulated walkthrough clearly labeled and separate.
- Have the three-minute walkthrough and screenshots ready before the presentation.
- Keep credentials, exact real addresses, private applications and unredacted legal documents off-screen.
- Test the appearance once on your own phone and rehearse the story once.
- Fill the submission platform's required fields and attach the final video/repository links through the operator's own account.
