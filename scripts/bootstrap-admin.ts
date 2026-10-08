import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const id = z.uuid().parse(process.argv[2]);
const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const u = await c.auth.admin.getUserById(id);
if (u.error || !u.data.user.email_confirmed_at)
  throw Error("Admin must have a verified Auth identity");
const p = await c
  .from("profiles")
  .select("demo_workspace,suspended")
  .eq("id", id)
  .single();
if (p.error || p.data.demo_workspace || p.data.suspended)
  throw Error("Active real profile required");
const r = await c
  .from("user_roles")
  .upsert({ user_id: id, role: "admin", status: "approved" });
if (r.error) throw Error("Admin bootstrap failed");
await c
  .from("audit_events")
  .insert({ event: "OPERATOR_ADMIN_BOOTSTRAP", resource_id: id });
console.log(
  "Verified real identity assigned platform administrator role. No credentials printed.",
);
