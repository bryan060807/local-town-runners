# Sidekick Errand Planner

Sidekick uses a model to turn a natural-language need into compared, reviewable combinations of actual marketplace items. It supports quantities, an overall item budget, local-only and one-shop preferences, clarification and follow-up revisions. One shared panel below Neighborhood Connection now contains both **Plan an errand** (the default) and **Find & ask** (quick discovery and authorized order questions). The second chatbot beside the map has been removed.

Switching tools preserves each tool's current draft, response and review state while showing one message composer at a time. Planning refinements stay with the current plan; quick questions keep their selected-listing context. These are separate tools, not a combined conversation history. An in-flight answer or cart save locks switching until it finishes. Catalog-rule answers and actual model-assisted answers retain their distinct labels.

The map now spans the available width. **Ask Sidekick about this area** opens and focuses **Find & ask** in the shared panel without submitting a request or replacing a draft. The Neighborhood Connection **Ask Sidekick** action opens the same tool with that item's context. A plan's **Show on map** action highlights its shops using current scoped catalog IDs and clears any previous runner highlight; a pickup description alone does not identify or assign a runner. Tool switching and map shortcuts do not write cart or order records.

## Try the AI experience

Enter a fresh private Customer demo, then choose **Plan an errand** in **Your local Sidekick** below the Neighborhood Connection panel. Select **Bakery stop under $20** and **Build an errand plan**. The request is:

> I need two cinnamon rolls and one more bakery item to share, under $20 total. Compare two combinations from one shop and check pickup.

The demo catalog supports two rolls plus the Berry Scone Pair for $16.00, or two rolls plus the Honey Oat Loaf for $17.50. The model interprets the request and chooses combinations; the server calculates their actual prices and validates them against fresh stock and the entire budget.

Then ask **Actually, just the two rolls.** The revised selection is $9.00. Expand **Review this option**, review the item quantities and total, then explicitly select **Save these choices to cart** and **View cart**. Adding choices does not prepare an order, reserve stock, charge PayPal or assign a runner. Other items already in the cart are not included in the planner subtotal. Each vendor's order is reviewed and prepared separately in the existing cart.

A broader semantic request can use interests rather than product names, for example a thank-you gift for someone who likes coffee and gardening. Sidekick can ask whether either interest is acceptable, then compare suitable standalone items after that clarification. The current catalog does not establish ingredient safety, dietary suitability or serving counts; food plans direct the user to confirm those details with the vendor.

## What the model does and what the server checks

`POST /api/assistant/plan` is model-first when configured and authenticated. It sends a bounded public catalog projection and at most six short recent conversation turns. It includes no stored private delivery addresses, account credentials, exact operational locations or full order history. User-entered requests and recent conversation are sent to the configured model; this is temporary browser-session context, not a persistent conversation database.

The model returns a strict `buildLocalPlan` proposal containing item IDs, quantities, interpreted constraints, a recommended alternative or a clarification. It cannot call checkout, capture, payout, assignment, SQL or administrative tools. There is normally one provider call. If a schema-valid proposal fails canonical validation, the server may make one corrective call with fresh catalog data and computed option totals. HTTP, authentication and transport failures do not cause an automatic retry. Each call has a 20-second timeout and bounded output; there are at most two attempts per request.

After each model response, the server re-reads the caller's scoped catalog, blocks, stock, availability and trip intentions. It validates every selected ID, SELL mode, quantity, stock, whole-option item budget, local-only/one-shop controls and the existing twenty-unit vendor-order limit. Every price, total, shop and pickup fact comes from those checked records. Duplicate whole alternatives are collapsed only after every alternative passes validation; duplicate item IDs remain invalid. Trip expiry is checked after model latency and withdrawn from the displayed pickup facts and current-trip reasons when its window ends.

Comparisons cover at most 100 caller-visible catalog listings. The interface reports the compared count and discloses truncation. It does not claim an exhaustive optimum, road ETA, guaranteed delivery, dietary certification or saved emissions.

## Provenance and explicit actions

**AI-assisted plan** means an actual model response passed canonical validation. **How this plan was made** shows the returned model name and catalog scope. **Catalog suggestions — AI unavailable** is the fallback for offline, unconfigured, unavailable or invalid planning responses; it never presents rule-based suggestions as model reasoning. Successful rule-based quick chat replies are labeled **Catalog helper**.

Plan review is read-only. Saving a reviewed option uses the existing authenticated cart endpoint once per selected item. It sets the chosen quantities and may partially succeed. The interface reports confirmed saves, keeps the review available and permits an idempotent retry; it does not claim an atomic bulk save. Cart preparation, payment, simulation and fulfillment retain their existing explicit controls and permissions.

## Configuration and verification

The existing `AI_API_KEY`, HTTPS `AI_BASE_URL` and actual model ID in `AI_MODEL` are sufficient. The verified Production model configuration is `gpt-4.1-mini`; a provider name such as `openai` is not a model ID. No schema migration, dependency or new environment variable is required.

Unit tests cover schema/visibility/stock/budget/quantity validation, exact totals, vendor limits, duplicate normalization, expiry, bounded requests, privacy, provider failures and the corrective-attempt cap. Browser fixtures explicitly identify mocked model responses; they are separate from actual configured-provider evidence.

The [clean-machine CI run](https://github.com/bryan060807/local-town-runners/actions/runs/40687360965) passed **146 unit/database tests and 168 browser checks**: 44 offline and 124 connected. Audit reported zero vulnerabilities. The focused local planner checks passed four offline and sixteen connected scenarios. Their model fixtures are explicitly labeled and are included in, not added to, the CI total.

The [hosted AI check](evidence/sidekick-planner-live-qa.json) used the actual configured provider on source `e7267cb679aab283789fe07450ae5d3f0f7b5778`. It received the two under-$20 bakery combinations, revised the plan to two rolls/$9, independently read the proposed private listing pages, reviewed the choice without writing, and then explicitly saved it to the cart. Both requests passed with one model attempt each. The cart survived reload; the owned cart row was removed and the demo exited. No order preparation, PayPal payment, runner assignment or payout was invoked. One desktop browser was resized to360px for the phone captures.

The [actual provider development probes](evidence/sidekick-planner-model-verification.json) separately exercised fictional in-memory catalog comparisons, a gift clarification and its refinement to the $28 mug/$18 planter. These development probes and the hosted requests are distinct from mocked-provider CI. The evidence also records the initial rejected over-budget/repeated-option proposals and their corrections; unvalidated choices were not published as successful plans.

All **ten read-only production checks** passed. A further SELECT-only check after hosted QA confirmed the existing three paid Sandbox orders, $44.00 and twelve ledger rows retain their previous complete fingerprint. Existing capture/webhook proof remains separate from this AI release.

See the [verification report](evidence/sidekick-planner.json), [CI evidence](evidence/sidekick-planner-ci.json), [production evidence](evidence/sidekick-planner-production.json), [actual hosted comparison](screenshots/sidekick-planner/SIDEKICK-PLANNER-LIVE-two-options-desktop-1280.png) and [screenshot provenance](screenshots/sidekick-planner/README.md). The [judge walkthrough](hackathon-demo.md) uses this AI comparison/refinement before the explicitly simulated $9 order.

## Unified layout verification — November 2, 2026

The single-panel layout on source `cae917fcb8587055622f38fc5e9c9e7b0b49ff37` passed anonymous live UI checks at 1280px, 360px, 390px and 430px. Each view retained both drafts while switching tools, showed one request composer, and opened that same discovery input from the map shortcut without submitting it. The map filled its available row, and the page had no horizontal overflow. Mobile inputs use 16px text, and legacy sidebar borders no longer create a nested assistant card.

The live check used GET/HEAD only and deliberately disabled WebGL, so its map screenshots document the fallback layout. Local regressions separately exercise map markers, contextual requests, retry protection, reviewed mocked-model plans and canonical vendor highlights. No fresh model call or financial transaction was needed for this presentation change.

Exact-source CI passed **146 unit/database tests and 176 browser checks**: 48 offline and 128 connected, with no failures, skips or flaky results. The dependency audit still reported 16 moderate advisories; its high-severity gate passed. Those findings are recorded for separate maintenance, rather than claiming a clean dependency audit.

See the [unified-layout report](evidence/unified-sidekick.json), [exact-source CI run](https://github.com/bryan060807/local-town-runners/actions/runs/41519374988) and [six production screenshots with provenance](screenshots/unified-sidekick/README.md). The earlier actual-provider and Sandbox records retain their original dates and sources.
