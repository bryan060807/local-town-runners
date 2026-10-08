import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (url !== "http://127.0.0.1:54321" || !key)
  throw Error(
    "This reset check requires only the dedicated loopback test backend",
  );
const c = createClient(url, key, { auth: { persistSession: false } });
async function snapshot() {
  const [orders, ledger, normal] = await Promise.all([
    c
      .from("orders")
      .select("id,state,paypal_order_id,paypal_capture_id,paypal_refund_id")
      .order("id"),
    c
      .from("ledger")
      .select("order_id,kind,amount_cents,simulated")
      .order("order_id")
      .order("kind"),
    c.from("profiles").select("id").is("demo_workspace", null).order("id"),
  ]);
  for (const r of [orders, ledger, normal]) if (r.error) throw r.error;
  return { orders: orders.data, ledger: ledger.data, normal: normal.data };
}
const before = await snapshot();
const reset = spawnSync(
  process.execPath,
  ["--import", "tsx", "scripts/reset-phase3.ts", "--expire-demo-sessions"],
  { stdio: "inherit" },
);
assert.equal(reset.status, 0);
assert.deepEqual(await snapshot(), before);
const [workspaces, sessions, template] = await Promise.all([
  c.from("demo_workspaces").select("expires_at").eq("is_template", false),
  c.from("demo_sessions").select("expires_at"),
  c
    .from("demo_workspaces")
    .select("expires_at")
    .eq("is_template", true)
    .single(),
]);
for (const r of [workspaces, sessions, template]) if (r.error) throw r.error;
assert.ok(workspaces.data!.length > 0);
assert.ok(sessions.data!.length > 0);
assert.ok(
  workspaces.data!.every((x) => Date.parse(x.expires_at) <= Date.now()),
);
assert.ok(sessions.data!.every((x) => Date.parse(x.expires_at) <= Date.now()));
assert.ok(Date.parse(template.data!.expires_at) > Date.now());
console.log(
  "Reset verified locally: visitor sessions expired; template, normal identities, all orders, capture/refund IDs and ledger entries preserved exactly.",
);
