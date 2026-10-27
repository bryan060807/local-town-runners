import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const customer = "21000000-0000-4000-8000-000000000001";
const vendor = "21000000-0000-4000-8000-000000000002";
const runner = "21000000-0000-4000-8000-000000000003";
const otherCustomer = "22000000-0000-4000-8000-000000000001";
const otherVendor = "22000000-0000-4000-8000-000000000002";
const otherRunner = "22000000-0000-4000-8000-000000000003";
const realCustomer = "23000000-0000-4000-8000-000000000001";
const realVendor = "23000000-0000-4000-8000-000000000002";
const workspace = "24000000-0000-4000-8000-000000000001";
const otherWorkspace = "24000000-0000-4000-8000-000000000002";
const shop = "25000000-0000-4000-8000-000000000001";
const otherShop = "25000000-0000-4000-8000-000000000002";
const realShop = "25000000-0000-4000-8000-000000000003";
const listing = "26000000-0000-4000-8000-000000000001";
const otherListing = "26000000-0000-4000-8000-000000000002";
const realListing = "26000000-0000-4000-8000-000000000003";
const token = "a".repeat(64);
const otherToken = "b".repeat(64);
const upgrade = await readFile(
  "supabase/migrations/016_demo_order_simulation.sql",
  "utf8",
);

type Order = {
  id: string;
  state: string;
  demo_simulated: boolean;
  demo_simulated_at: string | null;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  paypal_refund_id: string | null;
  refund_state: string;
};

async function fixture(includeSimulation = true) {
  const db = new PGlite();
  await db.exec(`
    create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
  `);
  for (const name of (await readdir("supabase/migrations"))
    .filter(
      (name) =>
        name.endsWith(".sql") &&
        (includeSimulation || !name.startsWith("016_")),
    )
    .sort()) {
    await db.exec(
      (await readFile(`supabase/migrations/${name}`, "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  }
  await db.exec(`
    update demo_settings set enabled=true;
    insert into demo_workspaces(id,expires_at) values('${workspace}',now()+interval '3 hours'),('${otherWorkspace}',now()+interval '3 hours');
    insert into auth.users values ${[customer, vendor, runner, otherCustomer, otherVendor, otherRunner, realCustomer, realVendor].map((id) => `('${id}')`).join(",")};
    update profiles set email_verified_at=now(),customer_terms=true,lifecycle='approved';
    update user_roles set status='approved';
    update profiles set demo_workspace='${workspace}' where id in ('${customer}','${vendor}','${runner}');
    update profiles set demo_workspace='${otherWorkspace}' where id in ('${otherCustomer}','${otherVendor}','${otherRunner}');
    insert into user_roles(user_id,role,status) values('${vendor}','vendor','approved'),('${runner}','runner','approved'),('${otherVendor}','vendor','approved'),('${otherRunner}','runner','approved'),('${realVendor}','vendor','approved');
    insert into vendors(id,owner_id,name,slug,category,public_lon,public_lat) values
      ('${shop}','${vendor}','UNIT demo shop','unit-demo','Food',-91.05,39.45),
      ('${otherShop}','${otherVendor}','UNIT other demo shop','unit-other-demo','Food',-91.05,39.45),
      ('${realShop}','${realVendor}','UNIT genuine shop','unit-genuine','Food',-91.05,39.45);
    insert into listings(id,vendor_id,title,category,mode,price_cents,inventory) values
      ('${listing}','${shop}','UNIT fictional roll','Food','SELL',450,100),
      ('${otherListing}','${otherShop}','UNIT other fictional roll','Food','SELL',450,100),
      ('${realListing}','${realShop}','UNIT genuine item','Food','SELL',450,100);
    insert into runners(id,public_lon,public_lat,available_until,categories,visible) values
      ('${runner}',-91.05,39.45,now()+interval '3 hours',array['Food'],true),
      ('${otherRunner}',-91.05,39.45,now()+interval '3 hours',array['Food'],true);
    insert into demo_sessions(token_hash,workspace_id,credentials,customer_id,vendor_id,runner_id,expires_at) values
      ('${token}','${workspace}','UNIT opaque credentials','${customer}','${vendor}','${runner}',now()+interval '3 hours'),
      ('${otherToken}','${otherWorkspace}','UNIT opaque other credentials','${otherCustomer}','${otherVendor}','${otherRunner}',now()+interval '3 hours');
  `);
  return db;
}

async function asRole<T>(
  db: PGlite,
  actor: string | null,
  sql: string,
  params: unknown[] = [],
  role = "authenticated",
) {
  await db.exec(`set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    actor || "",
  ]);
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function draft(
  db: PGlite,
  actor = customer,
  item = listing,
  quantity = 2,
) {
  return (
    await asRole<Order>(
      db,
      actor,
      "select (public.prepare_order($1,$2,$3,'UNIT fictional delivery address')).*",
      [item, quantity, randomUUID()],
    )
  ).rows[0];
}
async function simulate(
  db: PGlite,
  id: string,
  hash = token,
  actor = customer,
  role = "service_role",
) {
  return (
    await asRole<Order>(
      db,
      null,
      "select (public.simulate_demo_payment($1,$2,$3)).*",
      [id, hash, actor],
      role,
    )
  ).rows[0];
}
async function cancel(db: PGlite, id: string, hash = token, actor = vendor) {
  return (
    await asRole<Order>(
      db,
      null,
      "select (public.cancel_demo_order($1,$2,$3)).*",
      [id, hash, actor],
      "service_role",
    )
  ).rows[0];
}
async function one(db: PGlite, sql: string, params: unknown[] = []) {
  return (await db.query<Record<string, unknown>>(sql, params)).rows[0];
}

async function fulfill(db: PGlite, id: string) {
  for (const state of ["VENDOR_ACCEPTED", "RUNNER_MATCHING"])
    await asRole(
      db,
      vendor,
      "select public.transition_order($1,$2::public.order_state)",
      [id, state],
    );
  const offers = await asRole<{ id: string; demo_simulated: boolean }>(
    db,
    runner,
    "select * from public.available_runs_with_source()",
  );
  assert.ok(
    offers.rows.some((offer) => offer.id === id && offer.demo_simulated),
  );
  await asRole(db, runner, "select public.accept_run($1)", [id]);
  await asRole(
    db,
    vendor,
    "select public.transition_order($1,'READY_FOR_PICKUP')",
    [id],
  );
  for (const state of ["PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"])
    await asRole(
      db,
      runner,
      "select public.transition_order($1,$2::public.order_state)",
      [id, state],
    );
  await asRole(db, customer, "select public.transition_order($1,'COMPLETED')", [
    id,
  ]);
}

test("explicit demo payment is idempotent, provider-free and completes the existing fulfillment/rewards flow", async () => {
  const db = await fixture();
  try {
    const order = await draft(db);
    const result = await simulate(db, order.id);
    assert.equal(result.state, "PAID");
    assert.equal(result.demo_simulated, true);
    assert.ok(result.demo_simulated_at);
    assert.equal(result.paypal_order_id, null);
    assert.equal(result.paypal_capture_id, null);
    assert.equal(result.paypal_refund_id, null);
    assert.equal(result.refund_state, "NONE");
    assert.deepEqual(await simulate(db, order.id), result);
    const ledger = (
      await db.query<{
        kind: string;
        amount_cents: number;
        simulated: boolean;
      }>(
        "select kind,amount_cents,simulated from ledger where order_id=$1 order by kind",
        [order.id],
      )
    ).rows;
    assert.equal(ledger.length, 4);
    assert.ok(ledger.every((entry) => entry.simulated));
    assert.equal(
      ledger.find((entry) => entry.kind === "DEMO_PAYMENT")?.amount_cents,
      900,
    );
    assert.ok(!ledger.some((entry) => entry.kind === "CUSTOMER_PAYMENT"));
    for (const table of [
      "payment_events",
      "payment_recovery",
      "paypal_checkout_intents",
    ])
      assert.equal(
        Number(
          (
            await one(
              db,
              `select count(*) as count from ${table} where order_id=$1`,
              [order.id],
            )
          ).count,
        ),
        0,
      );
    assert.equal(
      Number(
        (await one(db, "select inventory from listings where id=$1", [listing]))
          .inventory,
      ),
      98,
    );
    assert.equal(
      Number(
        (
          await one(
            db,
            "select count(*) as count from order_events where order_id=$1 and event='DEMO_PAYMENT_SIMULATED'",
            [order.id],
          )
        ).count,
      ),
      1,
    );

    await fulfill(db, order.id);
    await assert.rejects(() =>
      asRole(db, customer, "select public.transition_order($1,'COMPLETED')", [
        order.id,
      ]),
    );
    assert.equal(
      Number(
        (
          await one(db, "select reward_points from runners where id=$1", [
            runner,
          ])
        ).reward_points,
      ),
      10,
    );
    assert.equal(
      Number(
        (
          await one(db, "select completed_runs from runners where id=$1", [
            runner,
          ])
        ).completed_runs,
      ),
      1,
    );
    await asRole(
      db,
      customer,
      "insert into reviews(order_id,customer_id,rating,comment) values($1,$2,1,'UNIT honest simulated review with useful detail.')",
      [order.id, customer],
    );
    const progress = (
      await asRole<Record<string, unknown>>(
        db,
        customer,
        "select * from public.my_community_progress()",
      )
    ).rows[0];
    assert.equal(Number(progress.points), 15);
    assert.equal(progress.demo, true);
    const stats = (
      await asRole<Record<string, unknown>>(
        db,
        customer,
        "select * from public.vendor_reputation($1)",
        [[shop]],
      )
    ).rows[0];
    assert.equal(Number(stats.completed_orders), 1);
    assert.equal(Number(stats.review_count), 1);
    assert.equal(Number(stats.average_rating), 1);
    assert.deepEqual(
      (
        await asRole(
          db,
          null,
          "select * from public.vendor_reputation($1)",
          [[shop]],
          "anon",
        )
      ).rows,
      [],
    );
    assert.deepEqual(
      (
        await asRole(
          db,
          otherCustomer,
          "select * from public.vendor_reputation($1)",
          [[shop]],
        )
      ).rows,
      [],
    );
    assert.deepEqual(
      (
        await asRole(
          db,
          realCustomer,
          "select * from public.vendor_reputation($1)",
          [[shop]],
        )
      ).rows,
      [],
    );
    assert.equal(
      Number(
        (
          await asRole<Record<string, unknown>>(
            db,
            realCustomer,
            "select * from public.my_community_progress()",
          )
        ).rows[0].points,
      ),
      0,
    );
    await db.exec(upgrade);
    assert.equal(
      Number(
        (
          await asRole<Record<string, unknown>>(
            db,
            customer,
            "select * from public.my_community_progress()",
          )
        ).rows[0].points,
      ),
      15,
    );
  } finally {
    await db.close();
  }
});

test("simulation requires the exact active private demo session and cannot be invoked by browser roles", async () => {
  const db = await fixture();
  try {
    const order = await draft(db);
    await assert.rejects(() =>
      simulate(db, order.id, token, customer, "authenticated"),
    );
    await assert.rejects(() => simulate(db, order.id, token, customer, "anon"));
    await assert.rejects(() => simulate(db, order.id, token, vendor));
    await assert.rejects(() => simulate(db, order.id, token, realCustomer));
    await assert.rejects(() =>
      simulate(db, order.id, otherToken, otherCustomer),
    );
    await assert.rejects(() =>
      simulate(db, order.id, "c".repeat(64), customer),
    );
    const changes = [
      [
        "update demo_settings set enabled=false",
        "update demo_settings set enabled=true",
      ],
      [
        `update demo_workspaces set is_template=true where id='${workspace}'`,
        `update demo_workspaces set is_template=false where id='${workspace}'`,
      ],
      [
        `update demo_workspaces set expires_at=now()-interval '1 second' where id='${workspace}'`,
        `update demo_workspaces set expires_at=now()+interval '3 hours' where id='${workspace}'`,
      ],
      [
        `update demo_sessions set expires_at=now()-interval '1 second' where token_hash='${token}'`,
        `update demo_sessions set expires_at=now()+interval '3 hours' where token_hash='${token}'`,
      ],
      [
        `update profiles set suspended=true where id='${customer}'`,
        `update profiles set suspended=false where id='${customer}'`,
      ],
      [
        `update profiles set suspended=true where id='${vendor}'`,
        `update profiles set suspended=false where id='${vendor}'`,
      ],
      [
        `update profiles set suspended=true where id='${runner}'`,
        `update profiles set suspended=false where id='${runner}'`,
      ],
    ];
    for (const [change, restore] of changes) {
      await db.exec(change);
      await assert.rejects(() => simulate(db, order.id));
      await db.exec(restore);
    }
    assert.equal(
      (await one(db, "select state from orders where id=$1", [order.id])).state,
      "DRAFT",
    );
    assert.equal(
      Number(
        (
          await one(
            db,
            "select count(*) as count from ledger where order_id=$1",
            [order.id],
          )
        ).count,
      ),
      0,
    );
    assert.equal(
      Number(
        (await one(db, "select inventory from listings where id=$1", [listing]))
          .inventory,
      ),
      98,
    );
  } finally {
    await db.close();
  }
});

test("genuine checkout intent and simulated payment are mutually exclusive at every provider boundary", async () => {
  const db = await fixture();
  try {
    const realIntent = await draft(db);
    await asRole(
      db,
      null,
      "select public.claim_paypal_checkout($1,$2)",
      [realIntent.id, customer],
      "service_role",
    );
    await asRole(
      db,
      null,
      "select public.claim_paypal_checkout($1,$2)",
      [realIntent.id, customer],
      "service_role",
    );
    assert.equal(
      Number(
        (
          await one(
            db,
            "select count(*) as count from paypal_checkout_intents where order_id=$1",
            [realIntent.id],
          )
        ).count,
      ),
      1,
    );
    await assert.rejects(() => simulate(db, realIntent.id));
    await assert.rejects(() =>
      asRole(
        db,
        customer,
        "insert into paypal_checkout_intents(order_id) values($1)",
        [realIntent.id],
      ),
    );
    const simulated = await draft(db);
    await simulate(db, simulated.id);
    const forbidden = [
      ["select public.claim_paypal_checkout($1,$2)", [simulated.id, customer]],
      [
        "select public.attach_verified_paypal_order($1,$2,$3)",
        [simulated.id, "UNIT-PAYPAL-ORDER", customer],
      ],
      [
        "select public.claim_payment_capture($1,$2)",
        [simulated.id, "UNIT-PAYPAL-ORDER"],
      ],
      [
        "select public.confirm_payment($1,$2,$3,900)",
        [simulated.id, "UNIT-CAPTURE", "UNIT-EVENT"],
      ],
      ["select public.begin_refund($1)", [simulated.id]],
      [
        "select public.confirm_refund($1,$2,900)",
        [simulated.id, "UNIT-REFUND"],
      ],
      [
        "insert into payment_events(event_id,order_id,capture_id) values('UNIT-FAKE-EVENT',$1,'UNIT-FAKE-CAPTURE')",
        [simulated.id],
      ],
      ["insert into payment_recovery(order_id) values($1)", [simulated.id]],
      [
        "insert into paypal_checkout_intents(order_id) values($1)",
        [simulated.id],
      ],
      [
        "insert into ledger(order_id,kind,amount_cents,simulated) values($1,'CUSTOMER_PAYMENT',900,false)",
        [simulated.id],
      ],
      [
        "update orders set paypal_capture_id='UNIT-FAKE-CAPTURE' where id=$1",
        [simulated.id],
      ],
      [
        "update orders set demo_simulated=false,demo_simulated_at=null where id=$1",
        [simulated.id],
      ],
    ] as [string, unknown[]][];
    for (const [sql, params] of forbidden)
      await assert.rejects(() => db.query(sql, params));
    // Existing financial observations must never be moved onto a different
    // order while its simulation/checkout decision is happening concurrently.
    const evidenceOwner = await draft(db);
    const target = await draft(db);
    await db.query(
      "select public.attach_verified_paypal_order($1,'UNIT-REPARENT-ORDER',$2)",
      [evidenceOwner.id, customer],
    );
    await db.query(
      "select public.confirm_payment($1,'UNIT-REPARENT-CAPTURE','UNIT-REPARENT-EVENT',900)",
      [evidenceOwner.id],
    );
    await db.query("insert into payment_recovery(order_id) values($1)", [
      evidenceOwner.id,
    ]);
    await db.query("insert into paypal_checkout_intents(order_id) values($1)", [
      evidenceOwner.id,
    ]);
    for (const table of [
      "ledger",
      "payment_events",
      "payment_recovery",
      "paypal_checkout_intents",
    ])
      await assert.rejects(() =>
        db.query(`update ${table} set order_id=$1 where order_id=$2`, [
          target.id,
          evidenceOwner.id,
        ]),
      );
    await assert.rejects(() => simulate(db, evidenceOwner.id));
    assert.equal(
      Number(
        (
          await one(
            db,
            "select count(*) as count from ledger where order_id=$1",
            [target.id],
          )
        ).count,
      ),
      0,
    );
    assert.equal(
      Number(
        (
          await one(
            db,
            "select count(*) as count from ledger where order_id=$1",
            [simulated.id],
          )
        ).count,
      ),
      4,
    );
    assert.equal(
      Number(
        (
          await one(
            db,
            "select count(*) as count from payment_events where order_id=$1",
            [simulated.id],
          )
        ).count,
      ),
      0,
    );
    await asRole(db, customer, "select public.cancel_draft($1)", [
      realIntent.id,
    ]);
    await db.query("delete from order_private where order_id=$1", [
      realIntent.id,
    ]);
    await db.query("delete from order_events where order_id=$1", [
      realIntent.id,
    ]);
    await db.query("delete from order_items where order_id=$1", [
      realIntent.id,
    ]);
    await db.query("delete from orders where id=$1", [realIntent.id]);
    assert.equal(
      Number(
        (
          await one(
            db,
            "select count(*) as count from paypal_checkout_intents where order_id=$1",
            [realIntent.id],
          )
        ).count,
      ),
      0,
    );
  } finally {
    await db.close();
  }
});

test("only the session vendor can cancel an unassigned simulation and inventory returns exactly once", async () => {
  const db = await fixture();
  try {
    const second = randomUUID();
    await db.query(
      "insert into listings(id,vendor_id,title,category,mode,price_cents,inventory) values($1,$2,'UNIT second item','Food','SELL',200,20)",
      [second, shop],
    );
    await asRole(
      db,
      customer,
      "insert into cart_items(customer_id,listing_id,quantity) values($1,$2,2),($1,$3,1)",
      [customer, listing, second],
    );
    const cart = (
      await asRole<Order>(
        db,
        customer,
        "select (public.prepare_cart($1,$2,'UNIT fictional delivery address')).*",
        [shop, randomUUID()],
      )
    ).rows[0];
    await simulate(db, cart.id);
    await assert.rejects(() => cancel(db, cart.id, token, customer));
    await assert.rejects(() => cancel(db, cart.id, otherToken, otherVendor));
    const result = await cancel(db, cart.id);
    assert.equal(result.state, "CANCELLED");
    assert.equal(result.refund_state, "NONE");
    assert.equal(result.paypal_refund_id, null);
    assert.deepEqual(await cancel(db, cart.id), result);
    assert.equal(
      Number(
        (await one(db, "select inventory from listings where id=$1", [listing]))
          .inventory,
      ),
      100,
    );
    assert.equal(
      Number(
        (await one(db, "select inventory from listings where id=$1", [second]))
          .inventory,
      ),
      20,
    );
    assert.equal(
      Number(
        (
          await one(
            db,
            "select count(*) as count from order_events where order_id=$1 and event='DEMO_ORDER_CANCELLED'",
            [cart.id],
          )
        ).count,
      ),
      1,
    );
    assert.equal(
      Number(
        (
          await one(
            db,
            "select count(*) as count from ledger where order_id=$1",
            [cart.id],
          )
        ).count,
      ),
      4,
    );
    assert.equal(
      Number(
        (
          await one(
            db,
            "select count(*) as count from ledger where order_id=$1 and kind='REFUND'",
            [cart.id],
          )
        ).count,
      ),
      0,
    );
    const assigned = await draft(db);
    await simulate(db, assigned.id);
    for (const state of ["VENDOR_ACCEPTED", "RUNNER_MATCHING"])
      await asRole(
        db,
        vendor,
        "select public.transition_order($1,$2::public.order_state)",
        [assigned.id, state],
      );
    await asRole(db, runner, "select public.accept_run($1)", [assigned.id]);
    await assert.rejects(() => cancel(db, assigned.id));
  } finally {
    await db.close();
  }
});

test("the additive simulation upgrade and retries preserve genuine order/payment history", async () => {
  const db = await fixture(false);
  try {
    const genuine = await draft(db, realCustomer, realListing);
    await db.query(
      "select public.attach_verified_paypal_order($1,'UNIT-GENUINE-ORDER',$2)",
      [genuine.id, realCustomer],
    );
    await db.query(
      "select public.confirm_payment($1,'UNIT-GENUINE-CAPTURE','UNIT-GENUINE-EVENT',900)",
      [genuine.id],
    );
    const orders = await db.query(
      "select to_jsonb(o)-'demo_simulated'-'demo_simulated_at' as data from orders o order by id",
    );
    const ledger = await db.query(
      "select row_to_json(l) as data from ledger l order by id",
    );
    const payments = await db.query(
      "select * from payment_events order by event_id",
    );
    await db.exec(upgrade);
    await db.exec(upgrade);
    assert.deepEqual(
      await db.query(
        "select to_jsonb(o)-'demo_simulated'-'demo_simulated_at' as data from orders o order by id",
      ),
      orders,
    );
    assert.deepEqual(
      await db.query("select row_to_json(l) as data from ledger l order by id"),
      ledger,
    );
    assert.deepEqual(
      await db.query("select * from payment_events order by event_id"),
      payments,
    );
    await assert.rejects(() => simulate(db, genuine.id));
    await assert.rejects(() => cancel(db, genuine.id));
    await db.query(
      "select public.confirm_payment($1,'UNIT-GENUINE-CAPTURE','UNIT-GENUINE-EVENT',900)",
      [genuine.id],
    );
    assert.equal(
      Number(
        (
          await one(
            db,
            "select count(*) as count from ledger where order_id=$1",
            [genuine.id],
          )
        ).count,
      ),
      4,
    );
  } finally {
    await db.close();
  }
});
