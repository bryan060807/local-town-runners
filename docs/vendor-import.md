# Import approved vendors

`npm run import:vendors -- approved-vendors.json` runs with a server-side service credential. The file contains an array of validated vendor records; each has UUID id/owner_id, name/slug/category, public_lon/public_lat, demo flag, optional approvalReference and a listings array. Listings have UUID id, title/description/category, SELL/MAKE/DO mode, integer price_cents/inventory and made_local flag. See `scripts/import-vendors.ts` for the strict schema.

A non-demo vendor requires an approval reference and is marked verified only through this controlled import. Approvals and permission to publish business details must be established by the operator. Do not substitute generated fictional businesses for approved records. Public coordinates are rounded in the database. Private pickup addresses never go in this public import file.

Import is idempotent by IDs but currently applies vendor/listing writes sequentially, not as one cross-vendor transaction; failures stop immediately and should be corrected before repeating. Do not run imports against unrelated cloud resources. Vendor owners must exist and possess vendor membership assigned by an administrator.
