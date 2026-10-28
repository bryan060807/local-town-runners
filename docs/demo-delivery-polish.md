# Demo delivery polish

This release addresses a reproduced browser-compatibility failure, simplifies the three-role demonstration and gives the landing page a warmer local story. It keeps fictional profiles, private workspaces, explicit user actions and genuine-versus-simulated payment evidence distinct.

The original live failure was reproduced in a fresh anonymous browser with WebGL disabled: the homepage returned HTTP 200, but MapLibre's constructor threw a graphics initialization error and the application displayed its general error screen. Default headless Chromium and software WebGL loaded normally. All three received the same normal demo status, `enabled: true, active: false`; that status was not the cause.

Map initialization, setup and context-loss failures now stay within the map. The fallback explains that browsing remains available and links to the vendor directory, moving keyboard focus to its heading. Search, the assistant and product/order controls remain usable. Tile failures retain their existing warning. The application-wide error page uses neutral language, a supported retry action and an Explore link.

The demo bar identifies the current role and keeps role explanations in optional help. Simulated orders name the next role and action. Checkout still requires the explicit simulation button or separately chosen PayPal Sandbox approval. No order, payment, role or fulfillment write was automated by these presentation changes.

The landing page adds a clear discovery action, a compact find/review/pickup explanation, warmer copy and a small decorative town illustration. Louisiana, Missouri remains the starting community. Fictional-vendor labels and simulated-payment/payout disclosures remain visible.

The [three-minute story](hackathon-demo.md) now follows one **$28 Handmade River Mug**. A fresh demo runner already has a trip to its vendor, so the existing-trip claim is grounded in current demo data. The complete [click-by-click guide](demo-order-walkthrough.md) retains every required handoff. A separately labeled existing **$4.50 genuine Sandbox proof** slide shows PayPal capture/webhook/ledger verification without associating it with the new simulated gift order or initiating another transaction.

While preparing the existing local development stack, repeated seeding exposed an older-account lookup limited to the first 1,000 Auth users. The seed script now follows bounded pagination metadata and exact email matching. The same local stack then seeded successfully without resets, account deletion or password changes. No hosted seeding was performed.

Local verification passed formatting, lint, types and all **108 unit/database tests**, **eight targeted offline browser checks** and **20 targeted connected checks** across desktop and phone widths. The connected scenarios exercise the complete gift story, normal fulfillment, entry/role guidance without WebGL and vendor discovery. Targeted checks are subsets of the full CI matrix, not additional distinct browser scenarios.

The final [GitHub Actions run](https://github.com/bryan060807/local-town-runners/actions/runs/40619734500) passed **108 unit/database tests**, **32 offline browser checks** and **80 connected browser checks**: **112 distinct browser scenarios**, with zero failures or skipped cases. The dependency audit reported zero vulnerabilities. [CI evidence](evidence/demo-delivery-polish-ci.json) records the exact source and counts; the earlier run was superseded by the SVG icon patch. [Combined release evidence](evidence/demo-delivery-polish.json) preserves the original reproduction, local checks, deployed checks and simulation boundaries.

No SQL migration, dependency upgrade or new application environment variable is required. Monitoring subscriptions, backup/retention execution, Live payments and real payouts remain outside this presentation release.

The final application source is `4ebd41bf49f5784024563ca401d4f6c620683003`. All ten [production operational checks](evidence/demo-delivery-polish-production.json) passed. Six [live public browser profiles](evidence/demo-delivery-polish-public-browser.json) cover default/software graphics, unsupported graphics, actual context loss and a 360px phone, with zero uncaught page errors, transport failures or horizontal overflow. The fallback arrow uses an SVG after a test browser exposed a missing Unicode glyph.

A [fresh hosted private API walkthrough](evidence/demo-delivery-polish-live-simulation.json) completed one $28 simulated gift order using the runner’s existing trip, retained four simulated ledger rows and made no financial provider calls or actual payouts. Simulation replay preserved evidence; repeat completion was safely rejected. That workflow used source `7eed5b1`; only the decorative fallback icon changed afterward. Visible handoffs were independently exercised through local Auth/PostgreSQL/browser tests and the final-source CI suite. The hosted QA session exited successfully.

All three genuine Sandbox orders retain their previous PAID states and complete order/ledger fingerprint, totaling $44.00 with one genuine customer-payment entry per order. The [screenshots](screenshots/demo-delivery-polish) distinguish live public rendering from explicitly labeled local simulated gift fixtures. No fresh provider capture or signed webhook delivery is inferred from these checks.

The final evidence commit changes documentation and sanitized screenshots only. Application runtime inputs remain those of the verified source above.
