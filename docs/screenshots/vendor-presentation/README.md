# Public vendor presentation screenshots

These four captures show the existing approved public MEM's Handcrafts storefront and Willie Nelson Doll listing on **October 30, 2026**, from production application source **`783e8708401625cb53e1f4c0cf3d8f2f635049cf`**.

| Screenshot                                                            | Viewport   | Shows                                                                     |
| --------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| [Desktop storefront](VENDOR-PRESENTATION-LIVE-storefront-1280.png)    | 1280 × 900 | Optional-demo wording and the linked product thumbnail, price and stock.  |
| [Phone-width storefront](VENDOR-PRESENTATION-LIVE-storefront-360.png) | 360 × 800  | Compact product row with a contained portrait and no horizontal overflow. |
| [Desktop listing](VENDOR-PRESENTATION-LIVE-listing-1280.png)          | 1280 × 900 | The full portrait beside product information and guest sign-in guidance.  |
| [Phone-width listing](VENDOR-PRESENTATION-LIVE-listing-360.png)       | 360 × 800  | Bounded portrait with title and price visible in the first viewport.      |

Each viewport used a separate anonymous headless Chromium context; the phone-width image is a browser viewport, not a physical-phone claim. Additional 390px and 430px checks passed. The diagnostic accepted only canonical-origin GET/HEAD requests, stripped cookies and blocked writes. It did not enter Demo Mode, sign in, edit the vendor, prepare an order, invoke the assistant, send email or initiate any payment, simulation or payout.

The product photo was not edited. Vendor-supplied material retains its owner's rights and is shown as part of the approved project demonstration; the application's ISC software license does not transfer ownership of vendor media. These are public presentation checks, not evidence of a new consent submission, commercial certification, checkout or delivery. See [the implementation guide](../../vendor-presentation.md) and [verification evidence](../../evidence/vendor-presentation.json).
