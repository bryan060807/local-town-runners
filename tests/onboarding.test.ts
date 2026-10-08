import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PDFDocument } from "pdf-lib";
import { definitions } from "../src/lib/onboarding/definitions";
import {
  vendorPayload,
  runnerPayload,
  signatureSchema,
} from "../src/lib/onboarding/schema";
import { consentPdf } from "../src/lib/onboarding/pdf";
const alice = "10000000-0000-4000-8000-000000000001",
  bob = "10000000-0000-4000-8000-000000000002",
  admin = "10000000-0000-4000-8000-000000000003",
  demo = "10000000-0000-4000-8000-000000000004";
const vendor = {
  name: "UNIT FIXTURE shop",
  representative: "Alice Unit",
  phone: "000 TEST",
  serviceArea: "Test town",
  description: "Unit fixture only",
  category: "Food",
  businessInfo: "",
  products: [
    {
      title: "Unit roll",
      description: "Test fixture",
      mode: "SELL",
      priceCents: 450,
      inventory: 5,
      availability: "By test appointment",
      photos: [],
    },
  ],
};
const runner = {
  name: "Unit Runner",
  phone: "000 TEST",
  serviceArea: "Test town",
  description: "Unit fixture only",
  transportation: "Bicycle",
  availability: "Weekday afternoons",
  radius: 5,
  maxDetour: 3,
  travelAreas: "Test downtown",
  pickupAreas: "Town center",
  routePreferences: "Existing bicycle trips",
  deliveryTypes: ["Food"],
  eligibility: "Unverified",
  locationConsent: true,
};
const signature = [
  [
    [10, 20],
    [40, 50],
    [60, 40],
  ],
];
async function setup() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated;grant select,insert,update,delete on storage.objects to anon,authenticated;create policy existing_wide_policy on storage.objects for all using(true) with check(true);`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(
      (await readFile(`supabase/migrations/${f}`, "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  await db.exec(
    `insert into auth.users values('${alice}','alice@unit.example',now()),('${bob}','bob@unit.example',null),('${admin}','admin@unit.example',now()),('${demo}','demo@unit.example',now());insert into user_roles(user_id,role) values('${admin}','admin');insert into demo_workspaces values('20000000-0000-4000-8000-000000000001',false,now()+interval '1 hour',now());update profiles set demo_workspace='20000000-0000-4000-8000-000000000001' where id='${demo}';update demo_settings set enabled=true;`,
  );
  for (const d of definitions)
    await db.query(
      "insert into agreement_versions(kind,version,title,sections,source_sha256,active) values($1,$2,$3,$4,$5,true)",
      [d.kind, d.version, d.title, JSON.stringify(d.sections), "a".repeat(64)],
    );
  const sections = JSON.parse(
    await readFile("docs/agreements/vdpcp-2026-10-08.json", "utf8"),
  );
  await db.query(
    "insert into agreement_versions(kind,version,title,sections,source_sha256,active) values('vendor','source-v1','VDPCP',$1,$2,true)",
    [JSON.stringify(sections), "b".repeat(64)],
  );
  return db;
}
async function as(db: PGlite, id: string, sql: string, args: unknown[] = []) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
  try {
    return await db.query<Record<string, unknown>>(sql, args);
  } finally {
    await db.exec("reset role");
  }
}
async function submit(db: PGlite, role = "vendor") {
  const p = role === "vendor" ? vendor : runner;
  const a = (
    await as(db, alice, "select save_application($1,$2) id", [
      role,
      JSON.stringify(p),
    ])
  ).rows[0].id as string;
  const def = (
    await db.query<{ id: string; sections: unknown }>(
      "select id,sections from agreement_versions where kind=$1 and active",
      [role],
    )
  ).rows[0];
  const s = (
    await as(db, alice, "select submit_application($1,$2,$3,$4,$5) id", [
      a,
      def.id,
      "Alice Unit",
      JSON.stringify(signature),
      JSON.stringify(def.sections),
    ])
  ).rows[0].id as string;
  return { a, s, def };
}
test("Phase 4 email verification and customer terms gate real purchases, not demo", async () => {
  const db = await setup();
  try {
    assert.equal(
      (await as(db, alice, "select has_role('customer') ok")).rows[0].ok,
      false,
    );
    const v = (
      await db.query<{ id: string }>(
        "select id from agreement_versions where kind='customer'",
      )
    ).rows[0].id;
    await assert.rejects(() =>
      as(db, bob, "select accept_customer_terms($1,$2)", [v, "Bob Unit"]),
    );
    await db.exec(
      `update auth.users set email_confirmed_at=now() where id='${bob}'`,
    );
    await as(db, bob, "select accept_customer_terms($1,$2)", [v, "Bob Unit"]);
    assert.equal(
      (await as(db, bob, "select has_role('customer') ok")).rows[0].ok,
      true,
    );
    assert.equal(
      (await as(db, demo, "select has_role('customer') ok")).rows[0].ok,
      true,
    );
    await assert.rejects(() =>
      as(db, demo, "select accept_customer_terms($1,$2)", [v, "Demo Unit"]),
    );
  } finally {
    await db.close();
  }
});
test("Phase 4 vendor consent is immutable, versioned, and duplicate submits retain one queue record", async () => {
  const db = await setup();
  try {
    const { a, s, def } = await submit(db);
    assert.equal(
      (
        await as(db, alice, "select submit_application($1,$2,$3,$4,$5) id", [
          a,
          def.id,
          "Another Name",
          JSON.stringify(signature),
          JSON.stringify(def.sections),
        ])
      ).rows[0].id,
      s,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from notification_deliveries",
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(() =>
      db.exec(
        `update agreement_submissions set typed_name='Overwrite' where id='${s}'`,
      ),
    );
    await assert.rejects(() =>
      db.exec(`delete from agreement_submissions where id='${s}'`),
    );
    await assert.rejects(() =>
      as(db, alice, "select save_application($1,$2)", [
        "vendor",
        JSON.stringify({ ...vendor, name: "Overwrite" }),
      ]),
    );
    await assert.rejects(() =>
      db.exec(
        `update agreement_versions set title='Changed' where id='${def.id}'`,
      ),
    );
    await db.exec(
      `update agreement_versions set active=false where id='${def.id}'`,
    );
    assert.equal(
      (
        await db.query<{ version: string }>(
          "select version from agreement_submissions",
        )
      ).rows[0].version,
      "source-v1",
    );
  } finally {
    await db.close();
  }
});
test("Phase 4 approval requires admin and PDF, is idempotent, and activates reviewed roles only", async () => {
  const db = await setup();
  try {
    for (const role of ["vendor", "runner"]) {
      const { a, s } = await submit(db, role);
      assert.equal(
        (await as(db, alice, "select has_role($1::app_role) ok", [role]))
          .rows[0].ok,
        false,
      );
      await assert.rejects(() =>
        as(db, alice, "select review_application($1,$2,$3)", [
          a,
          "approved",
          "forged",
        ]),
      );
      await assert.rejects(() =>
        as(db, admin, "select review_application($1,$2,$3)", [
          a,
          "approved",
          "no PDF",
        ]),
      );
      await db.query(
        "update agreement_documents set path=$1,sha256=$2 where submission_id=$3",
        [`UNIT-FIXTURE/${s}.pdf`, "c".repeat(64), s],
      );
      await as(db, admin, "select review_application($1,$2,$3)", [
        a,
        "approved",
        "Unit review",
      ]);
      await as(db, admin, "select review_application($1,$2,$3)", [
        a,
        "approved",
        "Duplicate",
      ]);
      assert.equal(
        (await as(db, alice, "select has_role($1::app_role) ok", [role]))
          .rows[0].ok,
        true,
      );
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::int n from application_decisions where application_id=$1",
            [a],
          )
        ).rows[0].n,
        1,
      );
    }
    await assert.rejects(() =>
      as(db, admin, `select assign_role('${bob}','runner',0,0)`),
    );
    await assert.rejects(() =>
      as(db, admin, `select assign_role('${bob}','admin',0,0)`),
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from vendors where demo=false",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
test("Phase 4 rejection retains consent; revision creates new evidence and cross-account/demo access is denied", async () => {
  const db = await setup();
  try {
    const { a, s } = await submit(db);
    for (const u of [bob, demo]) {
      assert.equal(
        (await as(db, u, "select * from role_applications")).rows.length,
        0,
      );
      assert.equal(
        (await as(db, u, "select * from agreement_submissions")).rows.length,
        0,
      );
      assert.equal(
        (await as(db, u, "select * from agreement_documents")).rows.length,
        0,
      );
    }
    await as(db, admin, "select review_application($1,$2,$3)", [
      a,
      "rejected",
      "Unit fixture rejection",
    ]);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from agreement_submissions where id=$1",
          [s],
        )
      ).rows[0].n,
      1,
    );
    const next = await submit(db);
    assert.notEqual(next.a, a);
    assert.notEqual(next.s, s);
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from agreement_submissions",
        )
      ).rows[0].n,
      2,
    );
    await assert.rejects(() =>
      as(db, demo, "select save_application($1,$2)", [
        "runner",
        JSON.stringify(runner),
      ]),
    );
    await db.exec(
      `insert into user_roles(user_id,role) values('${demo}','admin')`,
    );
    assert.equal(
      (await as(db, demo, "select platform_admin() ok")).rows[0].ok,
      false,
    );
  } finally {
    await db.close();
  }
});
test("Phase 4 private addresses, retention-aware deletion, and RLS resist forged status updates", async () => {
  const db = await setup();
  try {
    await as(
      db,
      alice,
      "insert into private_addresses(user_id,label,address) values($1,'Home','PRIVATE UNIT ADDRESS')",
      [alice],
    );
    assert.equal(
      (await as(db, bob, "select * from private_addresses")).rows.length,
      0,
    );
    assert.equal(
      (await as(db, demo, "select * from private_addresses")).rows.length,
      0,
    );
    await assert.rejects(() =>
      as(db, alice, "update profiles set lifecycle='approved'"),
    );
    await assert.rejects(() =>
      as(db, alice, "update user_roles set status='approved'"),
    );
    await as(db, alice, "select request_account_deletion()");
    await assert.rejects(() =>
      as(db, admin, `select moderate('profile','${alice}',false)`),
    );
    assert.equal(
      (await as(db, alice, "select real_account() ok")).rows[0].ok,
      false,
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from private_addresses",
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
test("Phase 4 storage bucket remains private even with an existing permissive object policy", async () => {
  const db = await setup();
  try {
    assert.equal(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets where id='onboarding-private'",
        )
      ).rows[0].public,
      false,
    );
    await db.exec(
      "insert into storage.objects(bucket_id,name) values('onboarding-private','private-consent.pdf')",
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      assert.equal(
        (await db.query("select * from storage.objects")).rows.length,
        0,
      );
      await assert.rejects(() =>
        db.exec(
          "insert into storage.objects(bucket_id,name) values('onboarding-private','forged.pdf')",
        ),
      );
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
test("Phase 4 notification claims serialize, accepted receipts never resend, old evidence cannot be overwritten", async () => {
  const db = await setup();
  try {
    const { s } = await submit(db);
    const n = (
      await db.query<{ id: string }>("select id from notification_deliveries")
    ).rows[0].id;
    await assert.rejects(() =>
      as(db, alice, "select claim_notification($1)", [n]),
    );
    await db.query("select claim_notification($1)", [n]);
    assert.equal(
      (
        await db.query<{ id: string }>("select (claim_notification($1)).id", [
          n,
        ])
      ).rows[0].id,
      null,
    );
    await db.query(
      "update notification_deliveries set status='accepted',provider_id='UNIT-RECEIPT',lease_until=null where id=$1",
      [n],
    );
    assert.equal(
      (
        await db.query<{ id: string }>("select (claim_notification($1)).id", [
          n,
        ])
      ).rows[0].id,
      null,
    );
    await db.query(
      "update agreement_documents set path=$1,sha256=$2 where submission_id=$3",
      ["private/first.pdf", "c".repeat(64), s],
    );
    await assert.rejects(() =>
      db.query(
        "update agreement_documents set path=$1 where submission_id=$2",
        ["private/overwrite.pdf", s],
      ),
    );
  } finally {
    await db.close();
  }
});
test("Phase 4 server schema validates touch signatures and vendor/runner fields", () => {
  assert.ok(vendorPayload.safeParse(vendor).success);
  assert.ok(runnerPayload.safeParse(runner).success);
  assert.ok(signatureSchema.safeParse(signature).success);
  assert.equal(
    signatureSchema.safeParse([
      [
        [9999, 1],
        [1, 1],
      ],
    ]).success,
    false,
  );
  assert.equal(
    vendorPayload.safeParse({ ...vendor, role: "admin" }).success,
    false,
  );
  assert.equal(
    runnerPayload.safeParse({ ...runner, locationConsent: false }).success,
    false,
  );
});
test("Phase 4 completed PDF includes original 12-section agreement and drawn signature across readable pages", async () => {
  const sections = JSON.parse(
    await readFile("docs/agreements/vdpcp-2026-10-08.json", "utf8"),
  );
  assert.equal(sections.length, 12);
  const original = await readFile("docs/agreements/VDPCP-original-blank.pdf");
  assert.ok(original.subarray(0, 4).equals(Buffer.from("%PDF")));
  const pdf = await consentPdf({
    id: alice,
    kind: "vendor",
    version: "source-v1",
    source_sha256: createHash("sha256").update(original).digest("hex"),
    created_at: "2026-10-08T12:00:00Z",
    typed_name: "Alice Unit",
    text_snapshot: sections,
    signature,
    application: vendor,
  });
  assert.ok(pdf.subarray(0, 4).equals(Buffer.from("%PDF")));
  const doc = await PDFDocument.load(pdf);
  assert.ok(doc.getPageCount() >= 6);
  assert.ok(pdf.length > 20000);
});

test("Phase 4 email retries keep the same idempotency key and never infer provider acceptance", async () => {
  const { sendApplicationEmail, uncertainDeliveryTooOld } =
    await import("../src/lib/onboarding/email");
  const input = {
    id: alice,
    kind: "runner",
    applicationId: bob,
    adminUrl: "https://example.invalid/admin/onboarding",
    apiKey: "UNIT-KEY",
    from: "Unit <unit@example.invalid>",
  };
  const keys: string[] = [];
  let attempts = 0;
  const transport = (async (_url: unknown, init: RequestInit) => {
    keys.push(new Headers(init.headers).get("Idempotency-Key")!);
    attempts++;
    return attempts === 1
      ? Response.json({ error: "unit failure" }, { status: 503 })
      : Response.json({ id: "UNIT-ACCEPTED-RECEIPT" });
  }) as typeof fetch;
  assert.equal((await sendApplicationEmail(input, transport)).status, "failed");
  assert.equal(
    (await sendApplicationEmail(input, transport)).status,
    "accepted",
  );
  assert.equal(keys[0], keys[1]);
  const invalid = (async () => Response.json({})) as typeof fetch;
  assert.equal((await sendApplicationEmail(input, invalid)).status, "failed");
  const timeout = (async () => {
    throw Error("UNIT timeout");
  }) as typeof fetch;
  assert.equal(
    (await sendApplicationEmail(input, timeout)).error,
    "DELIVERY_UNCONFIRMED",
  );
  assert.equal(
    uncertainDeliveryTooOld(
      "2026-10-01T00:00:00Z",
      2,
      Date.parse("2026-10-08T00:00:00Z"),
    ),
    true,
  );
});

test("Phase 4.1 durable jobs isolate admin retries, preserve receipts and record ordered delivery events", async () => {
  const db = await setup();
  try {
    const { s } = await submit(db);
    const n = (
      await db.query<{ id: string }>(
        "select id from notification_deliveries where submission_id=$1",
        [s],
      )
    ).rows[0].id;
    assert.equal(
      (
        await db.query<{ job_status: string }>(
          "select job_status from notification_deliveries where id=$1",
          [n],
        )
      ).rows[0].job_status,
      "pending",
    );
    await assert.rejects(() =>
      as(db, alice, "select claim_notification_v41($1,true)", [n]),
    );
    await db.query<Record<string, unknown>>(
      "update notification_deliveries set auto_dispatch=false where id=$1",
      [n],
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select (claim_notification_v41($1,false)).id id",
          [n],
        )
      ).rows[0].id,
      null,
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select (claim_notification_v41($1,true)).id id",
          [n],
        )
      ).rows[0].id,
      n,
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select (claim_notification_v41($1,true)).id id",
          [n],
        )
      ).rows[0].id,
      null,
    );
    await db.query<Record<string, unknown>>(
      "update notification_deliveries set status='accepted',provider_id='UNIT-ID',lease_until=null where id=$1",
      [n],
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select (claim_notification_v41($1,true)).id id",
          [n],
        )
      ).rows[0].id,
      null,
    );
    await db.query<Record<string, unknown>>(
      "select record_notification_event('UNIT-EVENT','UNIT-ID','email.delivered','2026-10-08T12:00:00Z')",
    );
    await db.query<Record<string, unknown>>(
      "select record_notification_event('UNIT-EVENT','UNIT-ID','email.delivered','2026-10-08T12:00:00Z')",
    );
    await db.query<Record<string, unknown>>(
      "select record_notification_event('UNIT-OLD','UNIT-ID','email.sent','2026-10-08T11:00:00Z')",
    );
    const row = (
      await db.query<Record<string, unknown>>(
        "select job_status,provider_event from notification_deliveries where id=$1",
        [n],
      )
    ).rows[0];
    assert.equal(row.job_status, "sent");
    assert.equal(row.provider_event, "delivered");
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select count(*)::int n from notification_provider_events where id='UNIT-EVENT'",
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(() =>
      as(
        db,
        alice,
        "select record_notification_event('x','UNIT-ID','email.sent',now())",
      ),
    );
    await assert.rejects(() =>
      as(
        db,
        alice,
        "insert into agreement_presentations(submission_id,format_version,path,sha256) values($1,'readable-v1','test.pdf','abc')",
        [s],
      ),
    );
    await db.query<Record<string, unknown>>(
      "insert into agreement_presentations(submission_id,format_version,path,sha256) values($1,'readable-v1','test.pdf','abc')",
      [s],
    );
    assert.equal(
      (await as(db, alice, "select * from agreement_presentations")).rows
        .length,
      0,
    );
    assert.equal(
      (await as(db, admin, "select * from agreement_presentations")).rows
        .length,
      1,
    );
    await assert.rejects(() =>
      db.query<Record<string, unknown>>(
        "update agreement_presentations set path='other.pdf'",
      ),
    );
    assert.equal(
      (
        await db.query<Record<string, unknown>>(
          "select count(*)::int n from agreement_submissions where id=$1",
          [s],
        )
      ).rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
