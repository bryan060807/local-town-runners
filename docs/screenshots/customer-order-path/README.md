# Customer order path evidence

`CUSTOMER-PATH-LIVE-*` images show `https://runners.aibrylabs.com` on source `f47e3dd8fb928b39aee930830ee6337fb613498f`. One newly created private Customer demo was used for all four images. The browser began at 1280×900, then resized to 360×800 for the phone captures; these are not separate mobile login sessions. All products, profiles and the delivery address are fictional.

The live check submitted the exact cinnamon-roll discovery with Enter, then the two-roll quote request with Send. It followed the actual bakery storefront link to the product page, selected quantity two and used **Add to cart**. The cart retained two units at $4.50 each and $9.00 total after reload. Cart addition left inventory unchanged. **Prepare this vendor order** was observed but never clicked: no live order, reservation, payment or runner assignment was created. Cleanup removed only this test's own cart item, confirmed an empty cart and zero orders, then exited the owned demo.

The four `*-LOCAL-LISTING-cart-two-rolls.png` images come from the connected **localhost** browser suite, on desktop and 360/390/430px viewports. Each local case subsequently used explicit preparation and verified exactly one unpaid $9.00 DRAFT after reload, stock reduced by two, and no ledger, PayPal order, capture or runner assignment. These localhost assertions are separate from the live cart-only check.

See [live evidence](../../evidence/customer-order-path-live-qa.json), [production checks](../../evidence/customer-order-path-production.json) and the [customer retest guide](../../customer-order-path.md). These screenshots do not establish a new genuine Sandbox capture or actual payout.
