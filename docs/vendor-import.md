# Import approved vendors

Run `npm run import:vendors -- approved-vendors.json` with securely configured Supabase service credentials. Import validates all IDs, owner vendor memberships, prices, modes and source-owned photos before the first write; it rejects attempts to transfer an existing vendor owner or move another vendor's listing. Reusing IDs updates records. Writes are sequential, not a batch transaction, so a database error can leave a partial batch; repair and repeat using the same IDs.

JSON is the supported format. The following is a template, not an approved real business. Replace UUID placeholders with actual provisioned IDs, and obtain permission to publish every real record. Real (`demo:false`) records require an operator approvalReference and are marked verified; demo records remain unverified. The approval reference is validated by the operator's import file; do not place private approval documents in public descriptions.

```json
[
  {
    "id": "VENDOR_UUID",
    "owner_id": "PROVISIONED_VENDOR_OWNER_UUID",
    "name": "APPROVED_BUSINESS_NAME",
    "slug": "approved-business-slug",
    "description": "Owner-approved public description",
    "category": "Food",
    "public_lon": -91.05,
    "public_lat": 39.45,
    "demo": false,
    "approvalReference": "OPERATOR_APPROVAL_REFERENCE",
    "hours": { "Friday": "Owner-confirmed hours" },
    "service_area": "Louisiana, Missouri",
    "website_url": "https://example.com",
    "social_urls": [],
    "listings": [
      {
        "id": "LISTING_UUID",
        "title": "OWNER_APPROVED_PRODUCT",
        "description": "Approved description and availability conditions",
        "category": "Food",
        "mode": "SELL",
        "price_cents": 450,
        "inventory": 12,
        "made_local": true,
        "active": true,
        "photos": []
      }
    ]
  }
]
```

Categories: Food, Gifts, Makers, Farm, Shops, Services. Modes: SELL, MAKE, DO. Made Local must reflect independently/local-produced goods or services, never chain inventory merely sold nearby. Photo URLs must belong to this project's sanitized marketplace-assets bucket; upload via the authenticated application route first. Website/social links must use HTTPS. Public coordinates are rounded by database triggers.

Private pickup information is entered separately by the vendor owner using the dashboard; never put pickup/home/delivery addresses in this public JSON, trip notes, AI context or descriptions. Import writes an admin-visible audit event. No scraping or invented real-vendor records are included. CSV input is not accepted; export your spreadsheet to this nested JSON format.
