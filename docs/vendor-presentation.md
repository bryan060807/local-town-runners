# Vendor storefront and product presentation

The first consenting local vendor's published storefront exposed three presentation problems: the inactive demo invitation described the current page as fictional, storefront rows omitted approved product photos, and a tall portrait pushed the listing details far below the image.

## Current behavior

- **Optional demo invitation:** outside an active private demo, the banner says **DEMO AVAILABLE** and invites the visitor to try fictional profiles in a separate workspace. An active demo retains **DEMO ONLY**, its fictional identities, role controls and simulation explanation.
- **Storefront browsing:** each product row links to its listing and shows the first approved public photo, title, short description, price or quote status and stock for SELL items. Images fit inside compact thumbnails without cropping; listings without photos retain an emoji fallback. Keyboard focus is visible and rows adapt to narrow screens.
- **Product photos:** the full image fits inside a bounded frame. Desktop places product details alongside it; phone layouts stack them with a shorter image frame. Title, price, vendor link and existing purchase/inquiry controls remain available. Portrait, landscape and no-photo listings use the same layout.

These changes affect presentation only. They do not change account approval, catalog visibility, image permissions, stock, prices, cart/order logic, payment processing or private-demo isolation. A real vendor account remains separate from the fictional role-switching demo. No SQL, environment change, reseeding or new onboarding submission is needed.

## Review the change

Open a public real vendor's storefront while signed out. Confirm the optional-demo wording, thumbnail and correct listing link. Follow the item and verify its entire portrait, title, price and sign-in guidance on desktop and a phone. An actual private demo must retain its role controls and explicit simulation labels.

Use the existing connected listing-purchase, catalog-scope and demo-journey browser suites for customer/cart/quote behavior and workspace boundaries. Layout checks against an existing real vendor can remain anonymous and GET-only; there is no reason to create a new payment or edit that vendor's record for a presentation check.

The October 30, 2026 release passed **146 unit/database tests** and **20 focused connected browser checks** across desktop and three phone widths. Read-only checks of the existing MEM's Handcrafts public storefront and portrait listing passed at **1280, 360, 390 and 430px**: thumbnail loading/link, correct optional-demo wording, contained full portrait, visible price and no horizontal overflow. No page errors, transport failures or blocked write attempts were recorded. The public checks did not sign in or change any vendor/order/payment record. See [verification evidence](evidence/vendor-presentation.json) and [actual hosted screenshots](screenshots/vendor-presentation/README.md).

The complete [GitHub Actions run](https://github.com/bryan060807/local-town-runners/actions/runs/41138978305) also passed on the exact application source: **146 unit/database tests and 168 browser checks** (44 offline, 124 connected), with zero failures and zero reported dependency vulnerabilities. The focused browser checks overlap that full suite; they are not additional distinct cases. The later screenshot/report commit changes documentation only.

Keep public screenshots free of private application information and operational addresses. Vendor-supplied photographs retain their owners' rights; app screenshots may illustrate the approved demonstration use. See the [submission capture guide](submission-checklist.md) and [security boundaries](security.md).
