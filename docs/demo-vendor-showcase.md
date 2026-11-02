# Real vendor previews inside Demo Mode

Demo Mode now includes a separate **Participating local businesses** showcase. It lets visitors see participating vendors' public profiles and listings alongside the fictional customer/vendor/runner walkthrough.

## Where to find it

1. Open [Local Town Runners](https://runners.aibrylabs.com) and enter **Demo Mode**, or refresh the homepage of an existing active private demo.
2. Scroll below **Sidekick Errand Planner** to **Participating local businesses**.
3. Expand a business card to preview its published products and services. SELL items display their public price; MAKE/DO listings say **Quote required**.

No new SQL, configuration, seeding or vendor-account changes are required. Existing active private sessions read the showcase on homepage refresh; there is no need to discard an order or re-enter the demo just to update these previews.

## What belongs in the showcase

The reader selects active real-vendor profiles outside demo workspaces and their active, available, nonprohibited public listings. It uses a fresh anonymous publishable-key client under the same public row-level security as a signed-out visitor. No signed-in identity, service-role key, private contact information, addresses, consent PDFs or signatures are used for this read.

The display is bounded to six businesses, ordered by name, and three listings per business, ordered by title. Extra businesses are indicated as a selection. Photos use the existing public asset allowlist; no new image copy or publication is performed. Profiles without available listings can still show their public description.

Approve and publish a vendor through the existing real onboarding/review process before expecting it here. Saved drafts, inactive vendors, private demo vendors and hidden/moderated listings do not qualify. Updating or unpublishing a source profile is reflected on the next homepage read; the preview does not maintain an independent stored copy.

## Separation from the order demonstration

The section is labeled **SHOWCASE ONLY**. Native expand/collapse cards have no shopping links, forms, cart, quote, payment or fulfillment actions. The real business is not impersonated by the fictional Vendor role.

The section is server-rendered into a separate display slot. These records are not merged into the private demo's catalog, map, Sidekick planning, cart, inquiries, runner matching, orders, earnings or reputation. Existing database scope checks continue to reject attempts to use a source real listing in a private demo cart/order. Real stock and actual vendor accounts are unchanged by browsing.

The fictional catalog remains the place to practice ordering, simulated payment and delivery. Genuine PayPal Sandbox evidence is still separate from both this read-only showcase and simulated fulfillment. The preview does not imply a real sale, vendor endorsement, verified business credentials or commercial readiness.

## Failure behavior and review

Public reads have a shared five-second timeout. If the optional showcase is unavailable, it displays a bounded message while the fictional walkthrough remains available. No query or authorization option was added to the transactional catalog reader.

The connected showcase regression uses only generated local fixtures. It checks public preview display, hidden/moderated exclusions, expansion without writes, unchanged source stock and private customer records, private catalog/AI separation, denied cross-scope cart access and source withdrawal after refresh. Existing scope and demo-journey checks remain applicable.

Use [the final delivery plan](final-submission-plan.md) for filming. A brief expanded real-business preview can show local participation without leaving Demo Mode or changing the tested fictional order story. Keep the showcase label visible in recordings.
