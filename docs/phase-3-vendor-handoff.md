# Future real-vendor handoff

Phase 3 contains only fictional content. The four prospective real vendors have not been imported, described, photographed, or assigned demo identities.

Real onboarding requires explicit authorization, approved business details, ownership verification and a normal Supabase account with administrator-assigned vendor role. Keep `profiles.demo_workspace` and `vendors.demo_workspace` null for real accounts; demo sessions only ever authenticate accounts in their own fictional workspace. Never convert a shared demo account into a real owner or transfer its historical payment IDs to a real business.

Use the existing approved-import process only in an authorized later phase. Collect public descriptions/hours/service areas and permission for images separately from private pickup addresses. Confirm stock, prices, SELL/MAKE/DO semantics and made-local claims with the owner. Precise pickup coordinates/addresses belong in private operational data, not public maps. Uploaded raster files continue through the existing metadata-stripping and server authorization pipeline.

Create separate normal shops/listings alongside the demo template. Disabling `demo_settings.enabled` removes demo visibility and protected demo access without deleting normal shops or historical transactions. Customer and vendor ownership policies stay in force. No normal checkout can purchase the isolated demo template.

Before real-money launch, implement and independently verify live merchant/recipient onboarding, permissions, disbursement, refund/dispute operations and account retention. A simulated allocation is never proof of a payout or merchant connection. Preserve every old Sandbox capture/refund ID and audit trail as historical test data.
