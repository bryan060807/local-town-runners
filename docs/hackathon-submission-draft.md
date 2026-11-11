# Local Town Runners — original hackathon entry copy

Originally prepared November 2, 2026. **Historical copy; the [published Devpost entry](https://devpost.com/software/paypal-proofpay) is the authoritative submission.** Devpost confirms submission November 4. On November 11 the owner approved the completed video and reported multiple successful full-demo runs. These statements do not independently verify the video's public viewing conditions, duration or its on-screen content. Do not invent vendor participation, interviews or outcome metrics.

**Name:** Local Town Runners

**Tagline:** Discover local goods and coordinate a pickup with a neighbor already going that way.

**Hosted app:** https://runners.aibrylabs.com

**Public source:** https://github.com/bryan060807/local-town-runners

**Judge instructions:** https://github.com/bryan060807/local-town-runners/blob/main/docs/hackathon-demo.md

**Submitted video:** https://youtu.be/3_TTpw0K51g (operator approved November 11, 2026).

## The problem and audience

A small local errand can be difficult to arrange even when someone nearby is already making the trip. Independent makers and neighborhood shops also need a clear way to show what they offer and coordinate the handoff.

Local Town Runners explores that problem in Louisiana, Missouri. It brings local discovery, an AI shopping plan, an explicit purchase decision and customer/vendor/runner coordination into one working prototype. MEM's Handcrafts is an example of a real participating local maker with a public storefront; the role-switching order demonstration uses fictional profiles in an isolated workspace.

## What it does

Customers explore vendor storefronts and listings, ask Sidekick to compare options, review the result and save their choices to a persistent cart. After explicit preparation and payment confirmation, the vendor and runner each confirm their part of fulfillment. The customer confirms completion. The prototype also includes vendor catalog tools, expiring runner availability/trip declarations, completed-order vendor reviews and private noncash recognition.

The guided demonstration follows two cinnamon rolls through a $9 cart and completed simulated delivery. The demonstration does not charge PayPal or send payouts. Real storefront participation and fictional simulated transactions are labeled separately.

## How AI contributes

Sidekick makes an actual model request to interpret a need, compare combinations against a whole-basket budget, account for locally-made/one-shop preferences, ask clarifying questions and revise the plan after a follow-up. In the documented hosted example, it compared $16 and $17.50 bakery baskets, then revised the choice to two rolls for $9.

The server independently rechecks catalog visibility, item IDs, stock, quantities, prices, budgets and current pickup facts. The model has no payment, assignment or administrative write authority. Users explicitly review and save choices; fallback catalog suggestions are labeled separately from actual AI output.

## How PayPal contributes

PayPal Sandbox is the genuine payment integration. The server creates checkout orders, verifies canonical capture status and matches amount, currency and marketplace order association before marking an order paid. Signed completed-capture webhooks and idempotent ledger processing support asynchronous confirmation; reconciliation can inspect an existing payment without starting another purchase.

Three genuine Sandbox payments totaling $44 have verified completed captures, matching PAID marketplace orders and one customer-payment entry each. The submission can show one existing $4.50 payment as readable proof. This evidence is separate from the fast simulated fulfillment walkthrough. Vendor and runner allocations remain simulated, with zero actual payouts. No Live payments are enabled.

## Implementation and verification

The prototype uses Next.js, React, TypeScript, Supabase/PostgreSQL, MapLibre, an OpenAI-compatible model integration, PayPal Sandbox, Resend and Vercel. Authentication, database row-level security and role-specific transitions enforce account/workspace boundaries. Real vendor onboarding records versioned consent and private PDF evidence before administrator review.

The latest exact-implementation CI verification passed 146 unit/database tests and 176 browser checks; its dependency audit reported 16 moderate advisories with the high-severity gate passing. Actual hosted AI responses, public vendor pages and genuine Sandbox capture/webhook records are documented separately from mocked-provider tests and simulated orders. The public repository includes the ISC license, setup instructions, architecture, security limits and judge walkthrough.

The initial MVP was committed October 6, 2026 Central. Subsequent October work added onboarding, payment recovery and completed Sandbox verification, private simulated fulfillment, community recognition, neighborhood discovery, model-backed errand planning and responsive vendor presentation.

## What is distinctive

The central idea is to connect a local purchase with a neighbor's declared existing trip. The prototype demonstrates the entire handoff, including an AI-assisted choice, review, vendor preparation, runner acceptance and customer completion. Temporary trip declarations are opportunities to coordinate; they are not guaranteed delivery commitments or optimized road routes.

## Current limits and next steps

This is a hackathon prototype. Vendor participation authorizes the current demo/Sandbox scope, not commercial fulfillment or payouts. Broader operation still needs independent security/capacity review, monitoring ownership, tested restoration, retention/deletion procedures and appropriate commercial agreements.

The next product step is a small consenting local pilot and genuine usability/demand feedback, followed by operational readiness work. The project does not claim verified customer adoption, real transaction revenue, measured community savings or autonomous spending.
