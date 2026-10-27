import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const owner = "11000000-0000-4000-8000-000000000001";
const buyers = Array.from(
  { length: 7 },
  (_, index) =>
    `12000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
);
const shop = "13000000-0000-4000-8000-000000000001";
const listing = "14000000-0000-4000-8000-000000000001";
const migration = await readFile(
  "supabase/migrations/015_community_reputation.sql",
  "utf8",
);

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
  `);
  for (const file of (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort())
    await db.exec(
      (await readFile(`supabase/migrations/${file}`, "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  await db.exec(`
    insert into auth.users values ${[owner, ...buyers].map((id) => `('${id}')`).join(",")};
    update profiles set email_verified_at=now(),customer_terms=true,lifecycle='approved';
    update user_roles set status='approved';
    insert into user_roles(user_id,role,status) values('${owner}','vendor','approved');
    insert into vendors(id,owner_id,name,slug,category,public_lon,public_lat)
      values('${shop}','${owner}','UNIT community shop','unit-community','Food',-91.05,39.45);
    insert into listings(id,vendor_id,title,category,mode,price_cents,inventory)
      values('${listing}','${shop}','UNIT item','Food','SELL',450,1000);
  `);
  return db;
}

async function asUser<T>(
  db: PGlite,
  id: string | null,
  sql: string,
  params: unknown[] = [],
  role = "authenticated",
) {
  await db.exec(`set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    id || "",
  ]);
  try {
    return await db.query<T>(sql, params);
  } finally {
    await db.exec("reset role");
  }
}

async function complete(
  db: PGlite,
  buyer: string,
  options: { listing?: string; rating?: number; comment?: string } = {},
) {
  const prepared = await asUser<{ id: string }>(
    db,
    buyer,
    "select (public.prepare_order($1,1,$2,'UNIT private delivery address')).*",
    [options.listing || listing, randomUUID()],
  );
  const id = prepared.rows[0].id;
  // A local DB fixture uses the real confirmation RPC and existing unique ledger
  // constraints; it never sends a financial request or claims a PayPal capture.
  await db.query("select public.attach_verified_paypal_order($1,$2,$3)", [
    id,
    `UNIT-ORDER-${id}`,
    buyer,
  ]);
  await db.query("select public.confirm_payment($1,$2,$3,450)", [
    id,
    `UNIT-CAPTURE-${id}`,
    `UNIT-EVENT-${id}`,
  ]);
  await db.query("update orders set state='COMPLETED' where id=$1", [id]);
  await db.query(
    "insert into order_events(order_id,event) values($1,'COMPLETED')",
    [id],
  );
  if (options.rating !== undefined)
    await asUser(
      db,
      buyer,
      "insert into reviews(order_id,customer_id,rating,comment) values($1,$2,$3,$4)",
      [
        id,
        buyer,
        options.rating,
        options.comment || "A thoughtful, factual unit fixture review.",
      ],
    );
  return id;
}

type PublicReputation = {
  vendor_id: string;
  completed_orders: number;
  review_count: number;
  average_rating: string | null;
  community_favorite: boolean;
};
type Progress = {
  completed_orders: number;
  thoughtful_reviews: number;
  points: number;
  vendor_completed_orders: number;
  vendor_review_count: number;
  vendor_average_rating: string | null;
  demo: boolean;
};
async function publicStats(db: PGlite, id: string | null = null, ids = [shop]) {
  return (
    await asUser<PublicReputation>(
      db,
      id,
      "select * from public.vendor_reputation($1)",
      [ids],
      id ? "authenticated" : "anon",
    )
  ).rows;
}
async function progress(db: PGlite, id: string) {
  return (
    await asUser<Progress>(
      db,
      id,
      "select * from public.my_community_progress()",
    )
  ).rows[0];
}

test("community progress rewards completed purchases and thoughtful feedback independently of stars, exactly once", async () => {
  const db = await fixture();
  try {
    const id = await complete(db, buyers[0], { rating: 1 });
    await complete(db, buyers[0], { rating: 5, comment: "Fine" });
    const stats = await progress(db, buyers[0]);
    assert.equal(Number(stats.completed_orders), 2);
    assert.equal(Number(stats.thoughtful_reviews), 1);
    assert.equal(Number(stats.points), 25);
    assert.equal(stats.demo, false);
    await assert.rejects(() =>
      asUser(
        db,
        buyers[0],
        "insert into reviews(order_id,customer_id,rating,comment) values($1,$2,5,'Duplicate reward attempt')",
        [id, buyers[0]],
      ),
    );
    await assert.rejects(() =>
      asUser(db, buyers[0], "update reviews set rating=5 where order_id=$1", [
        id,
      ]),
    );
    assert.deepEqual(await progress(db, buyers[0]), stats);
    assert.equal(Number((await progress(db, buyers[1])).points), 0);
    const vendor = await progress(db, owner);
    assert.equal(Number(vendor.points), 0);
    assert.equal(Number(vendor.vendor_completed_orders), 2);
    assert.equal(Number(vendor.vendor_review_count), 2);
    assert.equal(Number(vendor.vendor_average_rating), 3);

    const [publicResult] = await publicStats(db, null, [shop, shop]);
    assert.equal(Number(publicResult.completed_orders), 2);
    assert.equal(Number(publicResult.review_count), 2);
    assert.equal(Number(publicResult.average_rating), 3);
    assert.deepEqual(Object.keys(publicResult).sort(), [
      "average_rating",
      "community_favorite",
      "completed_orders",
      "review_count",
      "vendor_id",
    ]);

    const before = await db.query(
      "select row_to_json(o) as data from orders o order by id",
    );
    const ledger = await db.query(
      "select row_to_json(l) as data from ledger l order by id",
    );
    await db.exec(migration); // Operator retry is safe and never rebuilds awards.
    assert.deepEqual(await progress(db, buyers[0]), stats);
    assert.deepEqual(
      await db.query("select row_to_json(o) as data from orders o order by id"),
      before,
    );
    assert.deepEqual(
      await db.query("select row_to_json(l) as data from ledger l order by id"),
      ledger,
    );
  } finally {
    await db.close();
  }
});

test("public reputation needs distinct reviewers, preserves negative completed reviews after refunds, and hides disabled shops", async () => {
  const db = await fixture();
  try {
    for (let i = 0; i < 5; i++) await complete(db, buyers[0], { rating: 5 });
    assert.equal((await publicStats(db))[0].community_favorite, false);
    for (const buyer of buyers.slice(1, 5))
      await complete(db, buyer, { rating: 5 });
    assert.equal((await publicStats(db))[0].community_favorite, true);
    const negative = await complete(db, buyers[5], { rating: 1 });
    await complete(db, buyers[6], { rating: 1 });
    const [before] = await publicStats(db);
    assert.equal(Number(before.review_count), 11);
    assert.equal(Number(before.average_rating), 4.27);
    assert.equal(before.community_favorite, false);
    // Model later operator reconciliation without discarding earlier fulfilled
    // purchase history. Refunding never buys removal of an unfavorable review.
    await db.query(
      "update orders set state='CANCELLED',refund_state='COMPLETED',paypal_refund_id='UNIT-LATER-REFUND' where id=$1",
      [negative],
    );
    assert.deepEqual(await publicStats(db), [before]);
    assert.equal(Number((await progress(db, buyers[5])).points), 15);
    await db.query("update vendors set active=false where id=$1", [shop]);
    assert.deepEqual(await publicStats(db), []);
    await db.query("update vendors set active=true where id=$1", [shop]);
    await db.query("update profiles set suspended=true where id=$1", [owner]);
    assert.deepEqual(await publicStats(db), []);
    await assert.rejects(() => progress(db, owner));
  } finally {
    await db.close();
  }
});

test("reputation excludes self purchases, unsettled or fabricated payment evidence, and cross-workspace histories", async () => {
  const db = await fixture();
  try {
    await complete(db, owner, { rating: 5 });
    const incomplete = await complete(db, buyers[0], { rating: 5 });
    await db.query(
      "delete from order_events where order_id=$1 and event='COMPLETED'",
      [incomplete],
    );
    await db.query("update orders set state='PAID' where id=$1", [incomplete]);
    const mismatch = await complete(db, buyers[1], { rating: 5 });
    await db.query(
      "update ledger set amount_cents=1 where order_id=$1 and kind='CUSTOMER_PAYMENT'",
      [mismatch],
    );
    const simulated = await complete(db, buyers[2], { rating: 5 });
    await db.query(
      "update ledger set simulated=true where order_id=$1 and kind='CUSTOMER_PAYMENT'",
      [simulated],
    );
    const missing = await complete(db, buyers[3], { rating: 5 });
    await db.query("update orders set paypal_capture_id=null where id=$1", [
      missing,
    ]);
    const crossed = await complete(db, buyers[4], { rating: 5 });
    assert.ok(crossed);
    await db.exec(
      "insert into demo_workspaces(id,expires_at) values('15000000-0000-4000-8000-000000000001',now()+interval '1 hour'); update demo_settings set enabled=true;",
    );
    await db.query(
      "update profiles set demo_workspace='15000000-0000-4000-8000-000000000001' where id=$1",
      [buyers[4]],
    );
    const [stats] = await publicStats(db);
    assert.equal(Number(stats.completed_orders), 0);
    assert.equal(Number(stats.review_count), 0);
    assert.equal(stats.average_rating, null);
    assert.equal(Number((await progress(db, owner)).points), 0);
    assert.equal(Number((await progress(db, buyers[0])).points), 0);
  } finally {
    await db.close();
  }
});

test("aggregate API obeys demo isolation and grants no public customer scores or review records", async () => {
  const db = await fixture();
  try {
    const scopeA = "15000000-0000-4000-8000-000000000001";
    const scopeB = "15000000-0000-4000-8000-000000000002";
    const template = "15000000-0000-4000-8000-000000000003";
    const ids = [scopeA, scopeB, template];
    const shops: string[] = [];
    await db.exec("update demo_settings set enabled=true");
    for (const [index, scope] of ids.entries()) {
      const vendor = buyers[index * 2],
        customer = buyers[index * 2 + 1];
      const vendorId = randomUUID(),
        listingId = randomUUID();
      shops.push(vendorId);
      await db.query(
        "insert into demo_workspaces(id,is_template,expires_at) values($1,$2,now()+interval '1 hour')",
        [scope, scope === template],
      );
      await db.query("update profiles set demo_workspace=$1 where id=any($2)", [
        scope,
        [vendor, customer],
      ]);
      await db.query(
        "insert into user_roles(user_id,role,status) values($1,'vendor','approved')",
        [vendor],
      );
      await db.query(
        "insert into vendors(id,owner_id,name,slug,category,public_lon,public_lat) values($1,$2,'UNIT isolated shop',$3,'Food',-91.05,39.45)",
        [vendorId, vendor, `unit-${index}`],
      );
      await db.query(
        "insert into listings(id,vendor_id,title,category,mode,price_cents,inventory) values($1,$2,'UNIT isolated item','Food','SELL',450,100)",
        [listingId, vendorId],
      );
      await complete(db, customer, { listing: listingId, rating: 5 });
    }
    const all = [shop, ...shops];
    assert.deepEqual(
      (await publicStats(db, null, all)).map((row) => row.vendor_id).sort(),
      [shop, shops[2]].sort(),
    );
    assert.deepEqual(
      (await publicStats(db, buyers[1], all)).map((row) => row.vendor_id),
      [shops[0]],
    );
    assert.equal((await progress(db, buyers[1])).demo, true);
    await db.query(
      "update demo_workspaces set expires_at=now()-interval '1 second' where id=$1",
      [scopeA],
    );
    assert.deepEqual(await publicStats(db, buyers[1], all), []);
    await assert.rejects(() => progress(db, buyers[1]));
    await assert.rejects(() =>
      asUser(db, null, "select * from my_community_progress()", [], "anon"),
    );
    await assert.rejects(() =>
      asUser(db, null, "select * from reviews", [], "anon"),
    );
    await assert.rejects(() =>
      asUser(db, owner, "select * from my_community_progress($1)", [buyers[0]]),
    );
    await assert.rejects(() => publicStats(db, null, Array(101).fill(shop)));
  } finally {
    await db.close();
  }
});
