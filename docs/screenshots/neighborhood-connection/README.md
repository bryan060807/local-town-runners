# Neighborhood Connection screenshots

The `STUDIO-LIVE-*` captures show `https://runners.aibrylabs.com` on tested source `080381b1643b4ee0ba65da501d579b80c18c47bc`. They were captured by the preview-only browser check recorded in [live QA evidence](../../evidence/neighborhood-connection-live-qa.json).

- `public-desktop`, `public-mobile-360` and `public-mobile-430` show an anonymous catalog preview. A missing current trip remains an explicit pickup-planning state.
- `public-mobile-360-no-webgl` shows the same interactive preview with WebGL disabled. Browsing remains available through the existing map fallback.
- `private-preview` shows a newly entered private Customer demo, its fictional $28 mug/shop and Jordan's declared trip. Reviewing the find and asking Sidekick created no order, payment or runner assignment. This owned session exited successfully.
- `intro` means the first viewport; `panel` captures the full Neighborhood Connection section. Phone panels extend below the first viewport and require normal vertical scrolling.

The three `*-LOCAL-STUDIO-*` captures are **localhost evidence**, not production screenshots. They show the connected local fixture on application source `fffbf2cbaee70659a9be1c6d9aa0feb51e3ea56c`: a shared-trip candidate, that candidate's withdrawal after virtual-clock expiry, and explicit private demo entry on a 360px phone. The subsequent `080381b` commit changes only two legacy browser tests; application code is identical.

These images show fictional catalog/demo data and clearly labeled illustrations. They are not evidence of a new genuine PayPal capture or an actual payout. The separately documented historical Sandbox payment evidence remains unchanged.
