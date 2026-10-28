# Neighborhood Connection

This release turns the first screen into an interactive preview of the product's core idea: a current catalog item, its shop and a neighbor's declared trip. It replaces the previous introduction with one responsive connection canvas, while retaining the existing catalog, assistant, reviewed order preparation and role workflow.

Visitors choose **A gift under $30**, **Something to eat** or **Made nearby**, then compare up to three available finds. The item, price and shop come from the caller's visible catalog. The illustration is labeled separately from a product photograph. **Review this find** opens that actual listing; **Ask Sidekick** uses its explicit ID so duplicated product names cannot select a different listing.

A runner appears only when the visible trip targets that exact shop and both the runner's availability and trip window are unexpired. The panel labels this as a declared-trip candidate requiring confirmation. Its countdown is the end of that window, not a delivery estimate. The browser withdraws expired candidates without polling; newly posted trips and stock changes require a fresh catalog read or the existing server-side checks. The preview is deterministic and does not claim an AI booking, route optimization, guaranteed delivery or saved emissions.

When no trip is available, the panel says so. If Demo Mode is enabled, **Build a private demo** explicitly creates a fresh fictional customer/vendor/runner workspace through the existing demo entry endpoint. It does not prepare an order or invoke a payment. Public demo availability is never manufactured to fill an empty panel. Existing fictional-vendor, demo-runner, private-workspace and simulated-payment labels remain visible.

The entry banner is more compact so the product preview appears sooner on phones. Role responsibilities remain available after entering Demo Mode. The existing map fallback still preserves browsing when WebGL is unavailable, and the connection canvas itself uses ordinary HTML/SVG.

The server adds the chosen trip's existing expiry timestamp to the public runner DTO. Destination and expiry come from the same scoped trip row. Existing RLS, workspace filtering, narrow server-only scope lookup, order preparation, acceptance and payment permissions are unchanged. No migration, dependency or new environment variable is required.

Local verification passed **116 unit/database tests**, including eight new data-selection/expiry cases, plus **eight new offline browser checks**. Eight existing role/full-gift checks passed. The first new connected scenario used an assertion scoped inside the runner card even though the confirmation note is displayed beneath the two cards; correcting that scope preserved the required visible warning. All **eight corrected/new connected checks** then passed across desktop and 360/390/430px layouts, including explicit demo entry, exact listing context, expiry, zero created orders and zero financial calls. Final clean-machine CI and production evidence are recorded after release.

The [judge walkthrough](hackathon-demo.md) and [full demo guide](demo-order-walkthrough.md) use the private $28 Handmade River Mug connection. The separately labeled existing $4.50 genuine PayPal Sandbox proof remains distinct from that simulated order and from any preview.
