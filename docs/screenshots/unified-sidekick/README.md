# One Sidekick, two clearly labeled tools

These six element captures show the production UI on **November 2, 2026**, from application source **`cae917fcb8587055622f38fc5e9c9e7b0b49ff37`**.

| Screenshot                                                   | Browser viewport | Shows                                                                                                                              |
| ------------------------------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [Desktop planning](UNIFIED-SIDEKICK-LIVE-plan-1280.png)      | 1280 × 900       | The single shared Sidekick panel with **Plan an errand** selected and an unsubmitted draft.                                        |
| [Phone planning](UNIFIED-SIDEKICK-LIVE-plan-360.png)         | 360 × 800        | The same planning controls at phone width.                                                                                         |
| [Desktop discovery](UNIFIED-SIDEKICK-LIVE-discover-1280.png) | 1280 × 900       | **Find & ask** inside the same panel, with a retained, unsubmitted quick-question draft.                                           |
| [Phone discovery](UNIFIED-SIDEKICK-LIVE-discover-360.png)    | 360 × 800        | One visible composer, readable mobile input text and no nested sidebar card.                                                       |
| [Desktop map layout](UNIFIED-SIDEKICK-LIVE-map-1280.png)     | 1280 × 900       | A full-width map area and compact shortcut back to the same Sidekick. WebGL is intentionally disabled, so its fallback is visible. |
| [Phone map layout](UNIFIED-SIDEKICK-LIVE-map-360.png)        | 360 × 800        | The same map layout and shortcut without horizontal overflow.                                                                      |

One anonymous headless Chromium browser was resized across four viewports. Additional 390px and 430px checks passed; these are browser viewport checks, not physical-device claims. The browser accepted only canonical-origin GET/HEAD requests, stripped cookies and blocked every write and assistant/provider request. It typed drafts, switched tools and exercised the map shortcut without submitting anything. No demo entry, sign-in, AI request, cart save, order, payment, refund or fulfillment action occurred.

These captures document layout and navigation, not new model reasoning or a payment. Existing [actual hosted AI captures](../sidekick-planner/README.md) retain their original source and provenance. Local browser regressions separately cover real map markers, contextual questions, mocked-model plan review, cart safeguards and runner expiry. See the [Sidekick guide](../../sidekick-errand-planner.md) and [verification report](../../evidence/unified-sidekick.json).
