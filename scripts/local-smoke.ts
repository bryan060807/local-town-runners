import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  secret = process.env.SUPABASE_SERVICE_ROLE_KEY!,
  password = process.env.DEMO_SEED_PASSWORD!;
if (new URL(url).hostname !== "127.0.0.1")
  throw Error("This test is restricted to the local integration stack");
const service = createClient(url, secret, { auth: { persistSession: false } }),
  customer = createClient(url, key, { auth: { persistSession: false } }),
  other = createClient(url, key, { auth: { persistSession: false } }),
  runner = createClient(url, key, { auth: { persistSession: false } });
let outsider: string | undefined, orderId: string | undefined;
const listingId = "00000000-0000-4000-8000-000000000101";
try {
  const catalog = await customer.from("listings").select("id");
  assert.equal(catalog.error, null);
  assert.equal(catalog.data?.length, 15);
  const sign = await customer.auth.signInWithPassword({
    email: "customer@local-town-runners.example",
    password,
  });
  assert.equal(sign.error, null);
  assert.ok(sign.data.user);
  const signup = await other.auth.signUp({
    email: `local-test-${randomUUID()}@local-town-runners.example`,
    password,
  });
  assert.equal(signup.error, null);
  outsider = signup.data.user!.id;
  const escalation = await other
    .from("user_roles")
    .insert({ user_id: outsider, role: "admin" });
  assert.ok(escalation.error);
  const stock = await customer
    .from("listings")
    .select("inventory")
    .eq("id", listingId)
    .single();
  assert.equal(stock.error, null);
  const request = randomUUID();
  const params = {
    listing_id: listingId,
    qty: 2,
    request_key: request,
    delivery_address: "LOCAL TEST PRIVATE DELIVERY",
  };
  const prepared = await customer.rpc("prepare_order", params);
  assert.equal(prepared.error, null);
  orderId = prepared.data.id;
  const repeated = await customer.rpc("prepare_order", params);
  assert.equal(repeated.error, null);
  assert.equal(repeated.data.id, orderId);
  const reserved = await customer
    .from("listings")
    .select("inventory")
    .eq("id", listingId)
    .single();
  assert.equal(reserved.data?.inventory, stock.data!.inventory - 2);
  const leaked = await other.from("orders").select("id").eq("id", orderId!);
  assert.equal(leaked.data?.length, 0);
  const address = await other
    .from("order_private")
    .select("*")
    .eq("order_id", orderId!);
  assert.equal(address.data?.length, 0);
  const forged = await customer.rpc("confirm_payment", {
    order_id: orderId,
    capture_id: "FORGED",
    event_id: "FORGED",
    amount_cents: 900,
  });
  assert.ok(forged.error);
  const paid = await customer
    .from("orders")
    .update({ state: "PAID" })
    .eq("id", orderId!);
  assert.ok(paid.error);
  const rs = await runner.auth.signInWithPassword({
    email: "runner@local-town-runners.example",
    password,
  });
  assert.equal(rs.error, null);
  const indefinite = await runner
    .from("runners")
    .update({
      available_until: new Date(Date.now() + 31536000000).toISOString(),
    })
    .eq("id", rs.data.user!.id);
  assert.ok(indefinite.error);
  const cancelled = await customer.rpc("cancel_draft", { order_id: orderId });
  assert.equal(cancelled.error, null);
  const twice = await customer.rpc("cancel_draft", { order_id: orderId });
  assert.ok(twice.error);
  const restored = await customer
    .from("listings")
    .select("inventory")
    .eq("id", listingId)
    .single();
  assert.equal(restored.data?.inventory, stock.data!.inventory);
  console.log(
    "PASS: real local Supabase Auth sign-in/signup; PostgREST RLS; denied role/payment forgery; private addresses; idempotent reservation; availability limit; exactly-once stock restoration. No PayPal payment occurred.",
  );
} finally {
  if (orderId) {
    for (const table of ["order_private", "order_events"]) {
      const r = await service.from(table).delete().eq("order_id", orderId);
      if (r.error) throw r.error;
    }
    const r = await service.from("orders").delete().eq("id", orderId);
    if (r.error) throw r.error;
  }
  if (outsider) {
    const r = await service.auth.admin.deleteUser(outsider);
    if (r.error) throw r.error;
  }
}
