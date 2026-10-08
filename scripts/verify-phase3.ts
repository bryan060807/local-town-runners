import { createClient } from "@supabase/supabase-js";
import { demoProducts, templateWorkspace } from "../src/lib/demo-catalog";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw Error("Configure Supabase settings securely");
const c = createClient(url, key, { auth: { persistSession: false } });
const ready = await c.rpc("phase3_ready");
if (ready.error || ready.data !== true)
  throw Error("Hosted Phase 3 migration not ready");
const vendors = await c
  .from("vendors")
  .select("id,name,demo,verified")
  .eq("demo_workspace", templateWorkspace);
if (
  vendors.error ||
  vendors.data.length !== 4 ||
  vendors.data.some((x) => !x.demo || x.verified)
)
  throw Error("Fictional template vendors not ready");
const products = await c
  .from("listings")
  .select("title,mode,price_cents")
  .in(
    "vendor_id",
    vendors.data.map((x) => x.id),
  );
if (products.error || products.data.length !== demoProducts.length)
  throw Error("Expected 25 persisted template listings");
const enabled = await c.rpc("demo_mode_enabled");
if (enabled.error || enabled.data !== true)
  throw Error("Demo Mode is disabled");
console.log(
  "Phase 3 schema and enabled fictional template verified: four unverified demo vendors, 25 persisted listings. No credentials or account passwords printed.",
);
