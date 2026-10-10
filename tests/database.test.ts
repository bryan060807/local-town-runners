import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const customer = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  vendor = "33333333-3333-4333-8333-333333333333",
  runner = "44444444-4444-4444-8444-444444444444",
  shop = "55555555-5555-4555-8555-555555555555",
  listing = "66666666-6666-4666-8666-666666666666";
async function fixture(includePaymentRecovery = true) {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`,
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter(
      (f) =>
        f.endsWith(".sql") && (includePaymentRecovery || !f.startsWith("014_")),
    )
    .sort()) {
    const sql = (await readFile(`supabase/migrations/${file}`, "utf8")).replace(
      "create extension if not exists pgcrypto;",
      "",
    );
    await db.exec(sql);
  }
  await db.exec(
    `insert into auth.users values('${customer}'),('${other}'),('${vendor}'),('${runner}');update profiles set email_verified_at=now(),customer_terms=true,lifecycle='approved';update user_roles set status='approved';insert into public.user_roles(user_id,role) values('${vendor}','vendor'),('${runner}','runner');insert into public.vendors(id,owner_id,name,slug,category,public_lon,public_lat) values('${shop}','${vendor}','Demo','demo','Food',-91.051234,39.448923);insert into public.vendor_private values('${shop}','PRIVATE HOME',-91.051234,39.448923);insert into public.listings(id,vendor_id,title,category,mode,price_cents,inventory) values('${listing}','${shop}','Roll','Food','SELL',450,12);insert into public.runners(id,public_lon,public_lat,available_until,categories,visible) values('${runner}',-91.051234,39.448923,now()+interval '1 hour',array['Food'],true);`,
  );
  return db;
}
async function asUser(db: PGlite, id: string, sql: string) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role");
  }
}
async function createOrder(db: PGlite) {
  const r = await asUser(
    db,
    customer,
    `select (public.prepare_order('${listing}',2,'77777777-7777-4777-8777-777777777777','PRIVATE DELIVERY ADDRESS')).*`,
  );
  return (r.rows[0] as { id: string }).id;
}
test("RLS protects private addresses and role escalation", async () => {
  const db = await fixture();
  try {
    assert.equal(
      (await asUser(db, other, "select * from vendor_private")).rows.length,
      0,
    );
    assert.equal(
      (await asUser(db, vendor, "select * from vendor_private")).rows.length,
      1,
    );
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `insert into user_roles(user_id,role) values('${customer}','admin')`,
      ),
    );
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `update profiles set suspended=false where id='${customer}'`,
      ),
    );
    const r = await asUser(
      db,
      other,
      "select public_lon,public_lat from runners",
    );
    assert.equal(
      Number((r.rows[0] as { public_lon: string }).public_lon),
      -91.05,
    );
  } finally {
    await db.close();
  }
});
test("atomic order preparation reserves stock once and isolates ownership", async () => {
  const db = await fixture();
  try {
    const id = await createOrder(db);
    assert.equal(await createOrder(db), id);
    const r = await db.query("select inventory from listings");
    assert.equal((r.rows[0] as { inventory: number }).inventory, 10);
    assert.equal(
      (await asUser(db, other, "select * from orders")).rows.length,
      0,
    );
    await assert.rejects(() =>
      asUser(
        db,
        other,
        `select public.transition_order('${id}','VENDOR_ACCEPTED')`,
      ),
    );
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `select public.confirm_payment('${id}','fake','fake',900)`,
      ),
    );
    await assert.rejects(() =>
      asUser(db, customer, `update orders set state='PAID' where id='${id}'`),
    );
  } finally {
    await db.close();
  }
});
test("confirmed payment is idempotent; fulfillment has role gates and exactly-once rewards", async () => {
  const db = await fixture();
  try {
    const id = await createOrder(db);
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `select public.attach_paypal_order('${id}','PAYPAL-1')`,
      ),
    );
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `select public.attach_verified_paypal_order('${id}','PAYPAL-1','${customer}')`,
      ),
    );
    await db.exec(
      `select public.attach_verified_paypal_order('${id}','PAYPAL-1','${customer}')`,
    );
    await db.exec(
      `select public.confirm_payment('${id}','CAPTURE-1','EVENT-1',900);select public.confirm_payment('${id}','CAPTURE-1','EVENT-1',900);select public.confirm_payment('${id}','CAPTURE-1','EVENT-2',900);`,
    );
    assert.equal((await db.query("select * from ledger")).rows.length, 4);
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `select public.transition_order('${id}','VENDOR_ACCEPTED')`,
      ),
    );
    await asUser(
      db,
      vendor,
      `select public.transition_order('${id}','VENDOR_ACCEPTED');`,
    );
    await asUser(
      db,
      vendor,
      `select public.transition_order('${id}','RUNNER_MATCHING');`,
    );
    await asUser(db, runner, `select public.accept_run('${id}')`);
    assert.equal(
      (await asUser(db, runner, "select * from order_private")).rows.length,
      1,
    );
    await asUser(
      db,
      vendor,
      `select public.transition_order('${id}','READY_FOR_PICKUP');`,
    );
    for (const s of ["PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"])
      await asUser(
        db,
        runner,
        `select public.transition_order('${id}','${s}')`,
      );
    await asUser(
      db,
      customer,
      `select public.transition_order('${id}','COMPLETED')`,
    );
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `select public.transition_order('${id}','COMPLETED')`,
      ),
    );
    assert.equal(
      (await asUser(db, runner, "select * from order_private")).rows.length,
      0,
    );
    const r = await db.query("select reward_points from runners");
    assert.equal(
      Number((r.rows[0] as { reward_points: string }).reward_points),
      10,
    );
  } finally {
    await db.close();
  }
});
test("admin-only moderation and expiry are enforced in PostgreSQL", async () => {
  const db = await fixture();
  try {
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `select public.moderate('listing','${listing}',true)`,
      ),
    );
    await db.exec(
      `update runners set available_until=now()-interval '1 second';`,
    );
    assert.equal(
      (await asUser(db, other, "select * from runners")).rows.length,
      0,
    );
    await db.exec(
      `insert into user_roles(user_id,role) values('${other}','admin');`,
    );
    await asUser(
      db,
      other,
      `select public.moderate('listing','${listing}',true)`,
    );
    assert.equal(
      (await asUser(db, customer, "select * from listings")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("private delivery addresses never leak to another customer or vendor", async () => {
  const db = await fixture();
  try {
    await createOrder(db);
    assert.equal(
      (await asUser(db, other, "select * from order_private")).rows.length,
      0,
    );
    assert.equal(
      (await asUser(db, vendor, "select * from order_private")).rows.length,
      0,
    );
    assert.equal(
      (await asUser(db, runner, "select * from order_private")).rows.length,
      0,
    );
    assert.equal(
      (await asUser(db, customer, "select * from order_private")).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
test("direct API writes cannot create indefinite availability or edit another vendor", async () => {
  const db = await fixture();
  try {
    await assert.rejects(() =>
      asUser(
        db,
        runner,
        `update runners set available_until=now()+interval '1 year' where id='${runner}'`,
      ),
    );
    const result = await asUser(
      db,
      customer,
      `update listings set inventory=999 where id='${listing}' returning id`,
    );
    assert.equal(result.rows.length, 0);
    await asUser(
      db,
      vendor,
      `update listings set inventory=8 where id='${listing}'`,
    );
    assert.equal(
      (await db.query<{ inventory: number }>("select inventory from listings"))
        .rows[0].inventory,
      8,
    );
  } finally {
    await db.close();
  }
});
test("blocks prevent marketplace ordering and moderation hides suspended vendor inventory", async () => {
  const db = await fixture();
  try {
    await asUser(
      db,
      customer,
      `insert into blocks values('${customer}','${vendor}')`,
    );
    await assert.rejects(() => createOrder(db));
    await db.exec(
      `delete from blocks;update profiles set suspended=true where id='${vendor}';`,
    );
    assert.equal(
      (await asUser(db, customer, "select * from listings")).rows.length,
      0,
    );
    await assert.rejects(() => createOrder(db));
  } finally {
    await db.close();
  }
});

test("vendor creation, listing ownership and role provisioning are server enforced", async () => {
  const db = await fixture();
  try {
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `select public.create_vendor('Unapproved','unapproved','Food',-91.05,39.45)`,
      ),
    );
    const result = await asUser(
      db,
      vendor,
      `select public.create_vendor('Demo Two','demo-two','Food',-91.05,39.45)`,
    );
    const v = (result.rows[0] as { create_vendor: string }).create_vendor;
    const created = await asUser(
      db,
      vendor,
      `select public.create_listing('${v}','Test roll','Demo description','Food','SELL',450,4,true)`,
    );
    assert.ok(created.rows.length);
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `select public.create_listing('${v}','Attack','Description','Food','SELL',1,999,true)`,
      ),
    );
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `select public.assign_role('${customer}','admin',-91.05,39.45)`,
      ),
    );
    await db.exec(
      `insert into user_roles(user_id,role) values('${other}','admin');`,
    );
    await assert.rejects(() =>
      asUser(
        db,
        other,
        `select public.assign_role('${customer}','runner',-91.05,39.45)`,
      ),
    );
    assert.equal(
      (
        (await asUser(db, customer, `select public.has_role('runner')`))
          .rows[0] as { has_role: boolean }
      ).has_role,
      false,
    );
  } finally {
    await db.close();
  }
});
test("uncompleted orders cannot receive fabricated customer reviews", async () => {
  const db = await fixture();
  try {
    const id = await createOrder(db);
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `insert into reviews(order_id,customer_id,rating,comment) values('${id}','${customer}',5,'Fake delivered review')`,
      ),
    );
    await assert.rejects(() =>
      asUser(
        db,
        other,
        `insert into reviews(order_id,customer_id,rating,comment) values('${id}','${other}',5,'Another customer review')`,
      ),
    );
  } finally {
    await db.close();
  }
});

test("payment attachment is server-only and cannot change ownership or overwrite a bound ID", async () => {
  const db = await fixture();
  try {
    const id = await createOrder(db);
    await assert.rejects(() =>
      asUser(
        db,
        other,
        `select public.attach_verified_paypal_order('${id}','BAD','${other}')`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `select public.attach_verified_paypal_order('${id}','BAD','${other}')`,
      ),
    );
    await db.exec(
      `select public.attach_verified_paypal_order('${id}','PAYPAL','${customer}');select public.attach_verified_paypal_order('${id}','PAYPAL','${customer}');`,
    );
    await assert.rejects(() =>
      db.exec(
        `select public.attach_verified_paypal_order('${id}','DIFFERENT','${customer}')`,
      ),
    );
    assert.equal(
      (
        await db.query(
          "select * from order_events where event='PAYMENT_PENDING'",
        )
      ).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
test("runner cannot accept distant pickups and trip replacement has only one active destination", async () => {
  const db = await fixture();
  try {
    const id = await createOrder(db);
    await db.exec(
      `select public.attach_verified_paypal_order('${id}','PAYPAL','${customer}');select public.confirm_payment('${id}','CAPTURE','EVENT',900)`,
    );
    await asUser(
      db,
      vendor,
      `select public.transition_order('${id}','VENDOR_ACCEPTED')`,
    );
    await asUser(
      db,
      vendor,
      `select public.transition_order('${id}','RUNNER_MATCHING')`,
    );
    await asUser(db, runner, "update runners set public_lon=-90,public_lat=38");
    await assert.rejects(() =>
      asUser(db, runner, `select public.accept_run('${id}')`),
    );
    await asUser(
      db,
      runner,
      "update runners set public_lon=-91.05,public_lat=39.45",
    );
    await asUser(
      db,
      runner,
      `insert into runner_trips(runner_id,destination_vendor_id,expires_at) values('${runner}','${shop}',now()+interval '1 hour')`,
    );
    await asUser(
      db,
      runner,
      `insert into runner_trips(runner_id,destination_vendor_id,expires_at) values('${runner}','${shop}',now()+interval '2 hours')`,
    );
    assert.equal(
      (await db.query("select * from runner_trips where expires_at>now()")).rows
        .length,
      1,
    );
    await asUser(db, runner, `select public.accept_run('${id}')`);
  } finally {
    await db.close();
  }
});

test("Phase 3 cart snapshots multiple items, reserves once, and cancellation restores every line", async () => {
  const db = await fixture();
  try {
    const second = "99999999-9999-4999-8999-999999999999";
    await db.exec(
      `insert into listings(id,vendor_id,title,category,mode,price_cents,inventory) values('${second}','${shop}','Second product','Food','SELL',650,5)`,
    );
    await asUser(
      db,
      customer,
      `insert into cart_items values('${customer}','${listing}',2),('${customer}','${second}',1)`,
    );
    const sql = `select (prepare_cart('${shop}','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PRIVATE DELIVERY')).*`;
    const row = (await asUser(db, customer, sql)).rows[0] as {
      id: string;
      total_cents: number;
    };
    assert.equal(Number(row.total_cents), 1550);
    assert.equal(
      ((await asUser(db, customer, sql)).rows[0] as { id: string }).id,
      row.id,
    );
    assert.equal((await db.query("select * from order_items")).rows.length, 2);
    assert.equal(
      (await asUser(db, customer, "select * from cart_items")).rows.length,
      0,
    );
    await assert.rejects(() =>
      asUser(db, other, `select cancel_draft('${row.id}')`),
    );
    await asUser(db, customer, `select cancel_draft('${row.id}')`);
    await asUser(db, customer, `select cancel_draft('${row.id}')`);
    const stock = (
      await db.query<{ inventory: number }>(
        "select inventory from listings order by inventory",
      )
    ).rows;
    assert.deepEqual(
      stock.map((x) => x.inventory),
      [5, 12],
    );
  } finally {
    await db.close();
  }
});
test("Phase 3 workspace isolation, immutable roles, expiration, and fictional addresses", async () => {
  const db = await fixture();
  try {
    const scope = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.exec(
      `update demo_settings set enabled=true;insert into demo_workspaces(id,expires_at) values('${scope}',now()+interval '1 hour');update profiles set demo_workspace='${scope}' where id in ('${customer}','${vendor}','${runner}');update vendors set demo_workspace='${scope}',demo=true where id='${shop}'`,
    );
    assert.equal(
      (await asUser(db, other, "select * from listings")).rows.length,
      0,
    );
    assert.equal(
      (await asUser(db, customer, "select * from listings")).rows.length,
      1,
    );
    await assert.rejects(() =>
      asUser(
        db,
        other,
        `select prepare_order('${listing}',1,gen_random_uuid(),'REAL ADDRESS')`,
      ),
    );
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `update profiles set demo_workspace=null where id='${customer}'`,
      ),
    );
    const id = await createOrder(db);
    const address = (
      await asUser(db, customer, "select delivery_address from order_private")
    ).rows[0] as { delivery_address: string };
    assert.match(address.delivery_address, /DEMO TEST ADDRESS/);
    const newshop = (
      await asUser(
        db,
        vendor,
        `select create_vendor('Fictional scoped shop','scoped-shop','Food',-91.05,39.45)`,
      )
    ).rows[0] as { create_vendor: string };
    assert.equal(
      (
        await asUser(
          db,
          other,
          `select * from vendors where id='${newshop.create_vendor}'`,
        )
      ).rows.length,
      0,
    );
    await db.exec(`update demo_settings set enabled=false`);
    await assert.rejects(() =>
      asUser(db, customer, `select cancel_draft('${id}')`),
    );
    assert.equal(
      (await asUser(db, customer, "select * from listings")).rows.length,
      0,
    );
    await db.exec(
      `update demo_settings set enabled=true;update demo_workspaces set expires_at=now()-interval '1 second'`,
    );
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `select prepare_order('${listing}',1,gen_random_uuid(),'REAL ADDRESS')`,
      ),
    );
  } finally {
    await db.close();
  }
});
test("Phase 3 quotes cannot become checkout and entry rate limits are service-only", async () => {
  const db = await fixture();
  try {
    await db.exec(`update listings set mode='MAKE'`);
    await assert.rejects(() => createOrder(db));
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `insert into cart_items values('${customer}','${listing}',1)`,
      ),
    );
    await asUser(
      db,
      customer,
      `insert into inquiries(customer_id,listing_id,message) values('${customer}','${listing}','Fictional quote request')`,
    );
    assert.equal(
      (await asUser(db, other, "select * from inquiries")).rows.length,
      0,
    );
    await asUser(
      db,
      vendor,
      "update inquiries set response='Estimated quote',status='RESPONDED'",
    );
    assert.equal(
      (await asUser(db, customer, "select * from inquiries")).rows.length,
      1,
    );
    await assert.rejects(() =>
      asUser(db, customer, "select consume_demo_entry('hashed-key')"),
    );
    for (let i = 0; i < 5; i++)
      await db.exec("select consume_demo_entry('hashed-key')");
    await assert.rejects(() =>
      db.exec("select consume_demo_entry('hashed-key')"),
    );
  } finally {
    await db.close();
  }
});
test("Phase 3 verified refunds restore stock and ledger exactly once; pending refunds block fulfillment", async () => {
  const db = await fixture();
  try {
    const id = await createOrder(db);
    await db.exec(
      `select attach_verified_paypal_order('${id}','PAYPAL','${customer}');select confirm_payment('${id}','CAPTURE','EVENT',900)`,
    );
    await assert.rejects(() =>
      asUser(db, customer, `select begin_refund('${id}')`),
    );
    await db.exec(`select begin_refund('${id}')`);
    await assert.rejects(() =>
      asUser(db, vendor, `select transition_order('${id}','VENDOR_ACCEPTED')`),
    );
    await assert.rejects(() =>
      db.exec(`select confirm_refund('${id}','REFUND',1)`),
    );
    await db.exec(
      `select confirm_refund('${id}','REFUND',900);select confirm_refund('${id}','REFUND',900)`,
    );
    assert.equal(
      (await db.query<{ inventory: number }>("select inventory from listings"))
        .rows[0].inventory,
      12,
    );
    assert.equal(
      (await db.query("select * from ledger where kind='REFUND'")).rows.length,
      1,
    );
    assert.equal(
      (await db.query<{ state: string }>("select state from orders")).rows[0]
        .state,
      "CANCELLED",
    );
  } finally {
    await db.close();
  }
});

test("Phase 3 runner can decline only visible offers without canceling customer orders", async () => {
  const db = await fixture();
  try {
    const id = await createOrder(db);
    await db.exec(
      `select attach_verified_paypal_order('${id}','PAYPAL','${customer}');select confirm_payment('${id}','CAPTURE','EVENT',900)`,
    );
    await asUser(
      db,
      vendor,
      `select transition_order('${id}','VENDOR_ACCEPTED')`,
    );
    await asUser(
      db,
      vendor,
      `select transition_order('${id}','RUNNER_MATCHING')`,
    );
    assert.equal(
      (await asUser(db, runner, "select * from available_runs()")).rows.length,
      1,
    );
    await assert.rejects(() =>
      asUser(db, customer, `select decline_run('${id}')`),
    );
    await asUser(db, runner, `select decline_run('${id}')`);
    assert.equal(
      (await asUser(db, runner, "select * from available_runs()")).rows.length,
      0,
    );
    assert.equal(
      (await db.query<{ state: string }>("select state from orders")).rows[0]
        .state,
      "RUNNER_MATCHING",
    );
  } finally {
    await db.close();
  }
});

test("Phase 3 assignment requires compatibility with every cart line", async () => {
  const db = await fixture();
  try {
    const second = "99999999-9999-4999-8999-999999999999";
    await db.exec(
      `insert into listings(id,vendor_id,title,category,mode,price_cents,inventory) values('${second}','${shop}','Gift item','Gifts','SELL',650,5)`,
    );
    await asUser(
      db,
      customer,
      `insert into cart_items values('${customer}','${listing}',1),('${customer}','${second}',1)`,
    );
    const o = (
      await asUser(
        db,
        customer,
        `select (prepare_cart('${shop}','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','PRIVATE DELIVERY')).*`,
      )
    ).rows[0] as { id: string; total_cents: number };
    await db.exec(
      `select attach_verified_paypal_order('${o.id}','PAYPAL','${customer}');select confirm_payment('${o.id}','CAPTURE','EVENT',${o.total_cents})`,
    );
    await asUser(
      db,
      vendor,
      `select transition_order('${o.id}','VENDOR_ACCEPTED')`,
    );
    await asUser(
      db,
      vendor,
      `select transition_order('${o.id}','RUNNER_MATCHING')`,
    );
    assert.equal(
      (await asUser(db, runner, "select * from available_runs()")).rows.length,
      0,
    );
    await assert.rejects(() =>
      asUser(db, runner, `select accept_run('${o.id}')`),
    );
    await asUser(
      db,
      runner,
      "update runners set categories=array['Food','Gifts']",
    );
    assert.equal(
      (await asUser(db, runner, "select * from available_runs()")).rows.length,
      1,
    );
    await asUser(db, runner, `select accept_run('${o.id}')`);
  } finally {
    await db.close();
  }
});

test("payment recovery serializes capture claims and rejects conflicting capture/event IDs without extra ledger credits", async () => {
  const db = await fixture();
  try {
    const id = await createOrder(db);
    await db.exec(
      `select public.attach_verified_paypal_order('${id}','PAYPAL-RECOVERY','${customer}')`,
    );
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `select public.claim_payment_capture('${id}','PAYPAL-RECOVERY')`,
      ),
    );
    const claims = await Promise.all([
      db.query<{ claimed: boolean }>(
        `select public.claim_payment_capture('${id}','PAYPAL-RECOVERY') as claimed`,
      ),
      db.query<{ claimed: boolean }>(
        `select public.claim_payment_capture('${id}','PAYPAL-RECOVERY') as claimed`,
      ),
    ]);
    assert.deepEqual(claims.map((r) => r.rows[0].claimed).sort(), [
      false,
      true,
    ]);
    await Promise.all([
      db.exec(
        `select public.confirm_payment('${id}','CAPTURE-RECOVERY','MANUAL-RECOVERY',900)`,
      ),
      db.exec(
        `select public.confirm_payment('${id}','CAPTURE-RECOVERY','WEBHOOK-RECOVERY',900)`,
      ),
    ]);
    await db.exec(
      `select public.confirm_payment('${id}','CAPTURE-RECOVERY','WEBHOOK-RECOVERY',900)`,
    );
    await assert.rejects(() =>
      db.exec(`select public.confirm_payment('${id}','CONFLICT','THIRD',900)`),
    );
    await assert.rejects(() =>
      db.exec(`select public.confirm_payment('${id}','','EMPTY',900)`),
    );
    const ledger = (
      await db.query<{
        kind: string;
        amount_cents: number;
        simulated: boolean;
      }>(
        `select kind,amount_cents,simulated from ledger where order_id='${id}'`,
      )
    ).rows;
    assert.equal(ledger.length, 4);
    assert.equal(
      ledger
        .filter((l) => l.kind !== "CUSTOMER_PAYMENT")
        .every((l) => l.simulated),
      true,
    );
    assert.equal(
      ledger.find((l) => l.kind === "CUSTOMER_PAYMENT")?.simulated,
      false,
    );
    assert.equal(
      (await db.query(`select * from payment_events where order_id='${id}'`))
        .rows.length,
      2,
    );
    assert.equal(
      (
        await db.query(
          `select * from order_events where order_id='${id}' and event='PAYMENT_CONFIRMED'`,
        )
      ).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query<{ state: string }>(
          `select state from orders where id='${id}'`,
        )
      ).rows[0].state,
      "PAID",
    );
    const second = (
      await asUser(
        db,
        customer,
        `select (public.prepare_order('${listing}',1,'99999999-9999-4999-8999-999999999999','PRIVATE DELIVERY ADDRESS')).*`,
      )
    ).rows[0] as { id: string };
    await db.exec(
      `select public.attach_verified_paypal_order('${second.id}','PAYPAL-SECOND','${customer}')`,
    );
    await assert.rejects(() =>
      db.exec(
        `select public.confirm_payment('${second.id}','SECOND-CAPTURE','MANUAL-RECOVERY',450)`,
      ),
    );
    await assert.rejects(() =>
      db.exec(
        `select public.confirm_payment('${second.id}','CAPTURE-RECOVERY','SECOND-EVENT',450)`,
      ),
    );
    assert.equal(
      (await db.query(`select * from ledger where order_id='${second.id}'`))
        .rows.length,
      0,
    );
    assert.equal(
      (
        await asUser(
          db,
          other,
          `select * from payment_recovery where order_id='${id}'`,
        )
      ).rows.length,
      0,
    );
    await assert.rejects(() =>
      asUser(
        db,
        customer,
        `update payment_recovery set capture_attempted_at=null where order_id='${id}'`,
      ),
    );
  } finally {
    await db.close();
  }
});

test("payment upgrade preserves historical pending orders and blocks uncertain historical capture retries", async () => {
  const db = await fixture(false);
  try {
    const id = await createOrder(db);
    await db.exec(
      `select attach_verified_paypal_order('${id}','HISTORICAL','${customer}')`,
    );
    await db.exec(
      await readFile(
        "supabase/migrations/014_phase42_payment_recovery.sql",
        "utf8",
      ),
    );
    assert.equal(
      (
        await db.query<{ claimed: boolean }>(
          `select claim_payment_capture('${id}','HISTORICAL') as claimed`,
        )
      ).rows[0].claimed,
      false,
    );
    const row = (
      await db.query<{ state: string; paypal_capture_id: string | null }>(
        `select state,paypal_capture_id from orders where id='${id}'`,
      )
    ).rows[0];
    assert.equal(row.state, "PENDING_PAYMENT");
    assert.equal(row.paypal_capture_id, null);
    assert.equal(
      (await db.query(`select * from ledger where order_id='${id}'`)).rows
        .length,
      0,
    );
    await db.exec(
      `select confirm_payment('${id}','VERIFIED-HISTORICAL','RECOVERY',900)`,
    );
    assert.equal(
      (await db.query(`select * from ledger where order_id='${id}'`)).rows
        .length,
      4,
    );
  } finally {
    await db.close();
  }
});
