// Developer reset starts a NEW workspace; historical payments and real users are never deleted.
import { createClient } from "@supabase/supabase-js";
if (process.argv[2] !== "--expire-demo-sessions")
  throw Error(
    "Use --expire-demo-sessions to expire fictional visitor sessions only",
  );
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw Error("Configure Supabase environment first");
const c = createClient(url, key, { auth: { persistSession: false } });
const now = new Date().toISOString();
const workspaces = await c
  .from("demo_workspaces")
  .update({ expires_at: now })
  .eq("is_template", false);
if (workspaces.error) throw workspaces.error;
const sessions = await c
  .from("demo_sessions")
  .update({ expires_at: now })
  .gt("expires_at", now);
if (sessions.error) throw sessions.error;
console.log(
  "Visitor demo workspaces expired. Exit demo and enter again for fresh stock/accounts. Orders, ledgers, PayPal IDs, template and normal users preserved.",
);
