# Customer discovery to order preparation

The shareable product page now keeps the selected listing in the purchase flow. Customers choose a quantity, review the actual item total and select **Add to cart**. This saves that exact listing and quantity through the existing authenticated cart endpoint and opens the cart. Returning to a listing already in the cart restores its selected quantity and offers **Update cart**; this sets the desired quantity instead of adding another copy.

The cart preserves the existing review and **Prepare this vendor order** step. Adding an item does not reserve stock or create an order. Explicit preparation creates the persistent unpaid DRAFT and reserves stock; payment remains a separate action. MAKE/DO listings instead offer a quote request that appears in the customer's dashboard, without creating an order or payment.

Anonymous visitors receive sign-in and private-demo guidance. Vendor/runner demo profiles are directed to switch to Customer. The interface reads the caller's own approved role and cart; existing database account, workspace, customer-role and inventory guards remain authoritative. A public template listing is never silently reused after creating a private workspace.

Sidekick uses a visible **Send** control and native Enter submission. Its input waits for hydration, stays focused and read-only while a request is pending, and retains failed text for retry. Send, suggestions and the connection panel's **Ask Sidekick** are disabled during that request; an immediate request guard prevents duplicate submissions. Mobile text inputs use 16px text. The exact reported cinnamon-roll wording already worked in the baseline at all four viewport sizes; this change improves readiness, feedback and recovery rather than claiming a reproduced server failure.

## Retest the reported path

1. Open the app and enter a fresh private **Customer** demo.
2. Ask **Who has cinnamon rolls?** using Enter. **Get me two of the Habanero Cinnamon Rolls** using Send opens a reviewable $9.00 quote only.
3. For the direct storefront route, open **Demo Hearth Bakery**, then **Habanero Cinnamon Rolls**.
4. Choose quantity **2**, check **$9.00**, and select **Add to cart**.
5. Reload the cart: it should retain **2 × $4.50** and **Total $9.00**, with the fictional delivery address.
6. Select **Prepare this vendor order** only when ready to reserve the fictional stock. The dashboard shows one **$9.00 · DRAFT** after reload. Stop here to verify this repair without a payment.

The full simulated fulfillment walkthrough remains in the [demo order guide](demo-order-walkthrough.md). No schema migration, dependency or environment change is needed.

## Verification

Tested source: `f47e3dd8fb928b39aee930830ee6337fb613498f`. The [clean-machine CI run](https://github.com/bryan060807/local-town-runners/actions/runs/40632052895) passed **116 unit/database tests and 148 browser checks**: 40 offline and 108 connected. Dependency audit reported zero vulnerabilities. All 20 new focused connected checks also passed locally at desktop and 360/390/430px widths; those checks overlap the CI total.

A fresh hosted Customer demo submitted the exact discovery with Enter and the two-roll quote with Send, then followed the bakery storefront to the listing and saved quantity two. The **$9.00 cart survived reload**, with inventory unchanged. Hosted QA deliberately stopped before preparation, removed its own cart row, confirmed zero orders and exited its owned session. It used one desktop browser context resized to 360px for the phone captures. Explicit creation and persistence of one unpaid DRAFT, the exact stock reservation and zero ledger/PayPal/runner assignment are verified separately in the connected local/CI regressions.

All **ten production checks** passed. A separate read-only check after hosted QA confirmed the three existing paid Sandbox orders and all twelve ledger rows retain their prior fingerprint and $44.00 total. No provider payment, actual payout, protected payment record or production configuration was changed.

See the [verification report](evidence/customer-order-path.json), [CI evidence](evidence/customer-order-path-ci.json), [hosted cart evidence](evidence/customer-order-path-live-qa.json), [production checks](evidence/customer-order-path-production.json) and [screenshot provenance](screenshots/customer-order-path/README.md). The [hosted product page](screenshots/customer-order-path/CUSTOMER-PATH-LIVE-listing-desktop-1280.png) and [phone cart](screenshots/customer-order-path/CUSTOMER-PATH-LIVE-cart-resized-360.png) show the repaired handoff.
