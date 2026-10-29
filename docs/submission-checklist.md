# Hackathon submission and screenshot checklist

Use the [Fred bakery walkthrough](hackathon-demo.md) for the current story: two Habanero Cinnamon Rolls from Demo Hearth Bakery, **$9.00 total**. This is an operator checklist; unchecked items and suggested filenames do not represent screenshots already captured.

## Create the project license in GitHub

The project declares **ISC** in `package.json`. ISC permits reuse, modification and redistribution, including commercial use, while requiring the copyright and permission notices to remain. It disclaims warranties. Adding the matching file makes those terms explicit for the project; third-party assets retain their own license notices.

1. Sign into your GitHub account and open [Create LICENSE on main](https://github.com/bryan060807/local-town-runners/new/main?filename=LICENSE). Alternatively, open the repository, select **main**, then **Add file → Create new file**.
2. Name the root file exactly **LICENSE**, with no extension or folder prefix.
3. Paste the standard ISC text below. Replace **`[YOUR NAME OR LEGAL ENTITY]`** with the actual copyright owner. Use your name if you own the project personally; use an organization's name only if it owns the project. Keep the year **2026**.
4. Review the owner and license terms, then choose **Commit changes**. Use **Add ISC project license** as the commit message and commit to **main**, or merge the proposed branch if GitHub requires one.
5. Return to the repository and open **LICENSE** to confirm the committed text. GitHub should identify **ISC license** in its repository license display. Refresh after it processes the file. The license task is complete only after the file is committed to the default branch and GitHub recognizes it.

```text
ISC License

Copyright (c) 2026 [YOUR NAME OR LEGAL ENTITY]

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

## Set up one screenshot session

- [ ] Open [the hosted app](https://runners.aibrylabs.com) and enter a fresh private Demo Mode workspace. Stay in this browser session and use **Switch demo profile** throughout. Leaving and re-entering creates a different workspace.
- [ ] Switch to Runner **Jordan Ellis**, choose **Available for the next hour**, then share a one-hour trip to **Demo Hearth Bakery** under **I'm already going to…**. Return to Customer **Alex Carter**. The fresh workspace's initial trip points to a different shop. Renew the availability/trip if an hour elapses.
- [ ] Start with an empty cart and enough stock for two rolls. Fred is the narrated neighbor; Alex Carter is the fictional Customer profile visible in the app.
- [ ] Use a consistent desktop window, preferably 1440 × 900 or 1920 × 1080, at readable zoom. Close unrelated tabs and notifications. Capture a whole useful panel rather than a long, unreadable page.
- [ ] Keep DEMO, AI provenance, simulation and no-payout labels visible. Use only fictional delivery details and leave **Private operational addresses** collapsed. Remove passwords, tokens, real addresses, private application documents and unrelated account information from public images. Redaction must not change amounts, states or evidence.
- [ ] Keep original PNGs. Record capture date, browser/viewport, workspace/order reference and a one-sentence caption in your screenshot notes. Suggested filenames below make the sequence easy to follow.

Capture steps 1–9 in order, advancing the same simulated order. Step 10 is a **separate existing genuine Sandbox payment**.

## Ten main screenshots

1. [ ] **Neighborhood and discovery** — `01-neighborhood-desktop.png`.
       Show the homepage's Neighborhood Connection/Explore area with the bakery, a current declared trip if displayed, and the Demo profile context. Capture before scrolling into the planner.
       Caption: “Discover local goods and a neighbor's declared trip in a private demo workspace.”

2. [ ] **Actual AI comparison** — `02-sidekick-comparison.png`.
       Choose **Bakery stop under $20 → Build an errand plan**. Show the request, two returned combinations, totals and **AI-assisted plan** badge; expand **How this plan was made** where practical. The verified seeded example returned $16.00 and $17.50; valid model output can vary. Capture the actual result. A **Catalog suggestions — AI unavailable** result is fallback evidence, not AI generation.
       Caption: “Sidekick compares bakery combinations against a whole-basket budget using the current catalog.”

3. [ ] **AI revision and review** — `03-sidekick-two-rolls-review.png`.
       In the same conversation, send **Actually just the two rolls.** with **Update my plan**. Show quantity 2, $9.00 and **Review this option** expanded. Capture before navigating away; planner conversation is temporary and a full page navigation can clear it.
       Caption: “A follow-up revises the plan to two rolls for $9.00; the customer reviews the exact selection.”

4. [ ] **Reviewed cart** — `04-customer-cart-nine-dollars.png`.
       Choose **Save these choices to cart → View cart**. Show 2 × $4.50, the $9.00 total and **Prepare this vendor order**. Keep unrelated items out of this demo cart. Capture before preparing it.
       Caption: “The reviewed AI selection becomes an editable cart; saving a plan has not created or paid for an order.”

5. [ ] **Explicitly simulated payment** — `05-simulated-paid-order.png`.
       Review the fictional delivery address, choose **Prepare this vendor order**, then **Simulate demo payment** on the dashboard. Capture **$9.00 · PAID**, the new order ID, **SIMULATED DEMO ORDER — NO PAYPAL CHARGE** and the next-role guidance. Record this order ID for all remaining simulated screenshots.
       Caption: “The private demo simulates payment to demonstrate fulfillment; no PayPal charge or payout occurs.”

6. [ ] **Vendor handoff** — `06-vendor-accepted.png`.
       Switch to Vendor in the same workspace. Choose **Accept demo order** and capture the same order in **VENDOR ACCEPTED**, with **Find a runner** visible. Then choose **Find a runner** to advance to **RUNNER MATCHING** for the next step. An optional second image can show that matching state.
       Caption: “The vendor accepts the customer's order and requests a runner. Any earnings shown remain simulated.”

7. [ ] **Runner assignment** — `07-runner-assigned.png`.
       Switch to Runner and choose **Accept run** for that order. Capture **RUNNER ASSIGNED**, the item/order context and **Up next: Vendor** guidance. Then switch to Vendor and choose **Mark ready for pickup** before continuing.
       Caption: “An available runner explicitly accepts the pickup; the vendor still controls readiness.”

8. [ ] **Delivery handoff** — `08-runner-delivered.png`.
       Return to Runner. Choose **Confirm pickup → Start delivery → Confirm delivered** in order. Capture **DELIVERED** and the next Customer confirmation. Optionally take extra images at **READY FOR PICKUP**, **PICKED UP** and **OUT FOR DELIVERY** before advancing.
       Caption: “The runner confirms pickup and delivery; the customer has the final completion step.”

9. [ ] **Customer completion** — `09-customer-completed.png`.
       Switch to Customer, choose **Confirm order complete**, and capture **COMPLETED**, $9.00, the same order ID and simulation label. A completed-order review is an optional extra after this image.
       Caption: “The customer confirms the errand is complete. This is the same $9.00 simulated demo order.”

10. [ ] **Separate genuine PayPal Sandbox proof** — `10-paypal-sandbox-proof.png`, with supporting images if necessary.
        Use the existing verified **$4.50** payment: merchant capture **`17M125027B131373Y`**, marketplace order **`29945be0-236d-4a80-845a-36cf43b4fb1a`**. Show readable evidence of **COMPLETED** capture, matching **PAID** order, authentic completed-webhook association and exactly one **CUSTOMER_PAYMENT** entry for 450 cents. Three additional simulated allocation entries are expected; “one payment entry” does not mean one total ledger row.
        Caption: “Separate existing genuine PayPal Sandbox payment: $4.50, completed capture, matching PAID marketplace order, signed-webhook processing and one customer-payment entry. Allocations remain simulated; actual payouts are zero.”

The [Sandbox verification report](phase-4.3-sandbox-verification.md#current-completion-and-app-visibility--october-26) and its [sanitized completed-webhook evidence](evidence/phase-4.3/completion-2026-10-26/actual-completed-webhooks.json) already document step 10. You can show a clearly labeled excerpt of that dated report with evidence links if gathering fresh portal screenshots is inconvenient. Present an assembled proof slide as a summary of existing evidence, not as an unedited application screen or a newly made payment. A PAID screenshot alone cannot prove signature verification or ledger uniqueness.

If taking fresh account screenshots, use your own authorized seller Sandbox portal and your own approved administrator session. Read the existing record only. A fresh Customer demo does not inherit this old order. Do not reopen an expired demo identity, transfer ownership, change the paid order, replay webhooks, or initiate another checkout/capture/refund for documentation. These images must never imply the new $9.00 simulated order was paid through PayPal.

## Choose the public gallery and supporting images

Use five readable highlights for the submission gallery: **1 (neighborhood), 2 (AI comparison), 7 (runner assignment), 9 (completed errand) and 10 (genuine Sandbox proof)**. The video and supporting documentation can show the intermediate cart, refinement, payment and vendor steps. Describe the AI revision in the gallery caption or use image 3 instead of image 7 if the video already makes the runner handoff clear.

Useful extras for documentation:

- [ ] A 390px-wide mobile screenshot of the planner or cart, retaining totals and labels. Say whether this was a real phone or a resized desktop browser.
- [ ] Demo Hearth Bakery's storefront and the listing's quantity/total/cart controls.
- [ ] The prepared **DRAFT** before simulated payment, if documenting reservation behavior.
- [ ] A completed-order vendor review and private community recognition, labeled as private simulated activity.
- [ ] GitHub showing the detected ISC license and a completed CI run, as repository/readiness evidence rather than app functionality.

The four existing [`SIDEKICK-PLANNER-LIVE-*` images](screenshots/sidekick-planner/README.md) can support AI comparison, revision, review and cart documentation. They are dated release evidence from actual hosted model responses, not new captures from your current order. Preserve their provenance: desktop began at 1280 × 900, mobile images resized that same browser to 360 × 800, and the clock was UTC. Their runner was a compatible candidate; those images do not prove a declared bakery trip or completed fulfillment. Images named **LOCAL-MOCK-MODEL** demonstrate browser fixtures and must not be presented as genuine AI output.

When publishing new images in the repository, place only reviewed, sanitized copies in `docs/screenshots/submission/` and add a short README with filename, caption, capture date, source and viewport. Keep current-session shots separate from historical release screenshots. A cinematic illustration is presentation artwork, not application evidence.

## Final submission checks

- [ ] Root **LICENSE** is committed on the public repository's default branch and GitHub detects ISC.
- [ ] The description identifies the audience, problem, demonstrated benefit and limitations. State significant work completed during the submission period; Git history records the October 6 MVP (Central; October 7 UTC) and subsequent October AI, payment and fulfillment updates.
- [ ] The video shows actual application footage, preserves provenance/simulation labels, and finishes in **2:50–2:55**, including the cinematic opener and closing frame. Upload it to **YouTube**, set visibility to **Public**, and test the submitted URL while signed out.
- [ ] Cinematic images, music and voices are your own or properly licensed for the submitted use. Keep permissions and required attribution.
- [ ] Submission links point to the hosted app, public source, video and walkthrough. Test a fresh private Demo Mode session while signed out of operator accounts; judges should not need your administrator credentials or server API keys.
- [ ] Hosting, Demo Mode, AI quota and the needed integrations remain available to judges free of charge through **December 15, 2026, 10:00 a.m. Central**. Current provider configuration and availability still need a final pre-submission check.
- [ ] Complete the Devpost registration and all required entry fields before **November 12, 2026, 2:00 p.m. Central**. Check the official event page for amendments before submitting.

Dates above convert the supplied official rules' Pacific times to America/Chicago. This checklist does not establish entrant eligibility, asset ownership or organizer acceptance; complete those operator-specific checks before entry.
