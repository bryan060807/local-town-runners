import { createClient } from "@supabase/supabase-js";
import { provisionDemo } from "../src/lib/demo-provision";
import { templateWorkspace } from "../src/lib/demo-catalog";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw Error(
    "Configure Supabase URL and service-role key in environment settings",
  );
const c = createClient(url, key, { auth: { persistSession: false } });
const existing = await c
  .from("demo_workspaces")
  .select("id")
  .eq("id", templateWorkspace)
  .maybeSingle();
if (existing.error) throw Error("Apply Phase 3 migrations before seeding");
const enabled = await c
  .from("demo_settings")
  .update({ enabled: true })
  .eq("id", true);
if (enabled.error) throw enabled.error;
if (!existing.data) await provisionDemo(c, templateWorkspace, true);

const illustration = await c
  .from("vendors")
  .update({ cover_url: "/demo/riverbend-cover.webp" })
  .eq("demo_workspace", templateWorkspace)
  .eq("name", "Riverbend Market & Goods");
if (illustration.error) throw illustration.error;
console.log(
  "Fictional Phase 3 template is ready. Existing records and payment history preserved. Demo credentials were not printed.",
);
