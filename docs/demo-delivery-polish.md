# Demo delivery polish

This release addresses a reproduced browser-compatibility failure, simplifies the three-role demonstration and gives the landing page a warmer local story. It keeps fictional profiles, private workspaces, explicit user actions and genuine-versus-simulated payment evidence distinct.

The original live failure was reproduced in a fresh anonymous browser with WebGL disabled: the homepage returned HTTP 200, but MapLibre's constructor threw a graphics initialization error and the application displayed its general error screen. Default headless Chromium and software WebGL loaded normally. All three received the same normal demo status, `enabled: true, active: false`; that status was not the cause.

Map initialization, setup and context-loss failures now stay within the map. The fallback explains that browsing remains available and links to the vendor directory, moving keyboard focus to its heading. Search, the assistant and product/order controls remain usable. Tile failures retain their existing warning. The application-wide error page uses neutral language, a supported retry action and an Explore link.

The demo bar identifies the current role and keeps role explanations in optional help. Simulated orders name the next role and action. Checkout still requires the explicit simulation button or separately chosen PayPal Sandbox approval. No order, payment, role or fulfillment write was automated by these presentation changes.

The landing page adds a clear discovery action, a compact find/review/pickup explanation, warmer copy and a small decorative town illustration. Louisiana, Missouri remains the starting community. Fictional-vendor labels and simulated-payment/payout disclosures remain visible.

The [three-minute story](hackathon-demo.md) now follows one **$28 Handmade River Mug**. A fresh demo runner already has a trip to its vendor, so the existing-trip claim is grounded in current demo data. The complete [click-by-click guide](demo-order-walkthrough.md) retains every required handoff. A separately labeled existing **$4.50 genuine Sandbox proof** slide shows PayPal capture/webhook/ledger verification without associating it with the new simulated gift order or initiating another transaction.

While preparing the existing local development stack, repeated seeding exposed an older-account lookup limited to the first 1,000 Auth users. The seed script now follows bounded pagination metadata and exact email matching. The same local stack then seeded successfully without resets, account deletion or password changes. No hosted seeding was performed.

Local verification so far: formatting, lint, types and all **108 unit/database tests** passed. All **eight targeted offline browser checks** passed, including unsupported WebGL and unavailable map tiles across desktop and phone layouts. Connected walkthrough checks and the clean-machine CI/deployed release verification are recorded after completion in the release evidence; this document does not infer a new genuine payment from a fixture or simulation.

No SQL migration, dependency upgrade or new application environment variable is required. Monitoring subscriptions, backup/retention execution, Live payments and real payouts remain outside this presentation release.
