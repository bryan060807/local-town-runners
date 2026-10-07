import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (url !== "http://127.0.0.1:54321")
  throw Error("Import smoke test is local-only");
const c = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const users = await c.auth.admin.listUsers();
if (users.error) throw users.error;
const owner = users.data.users.find(
  (u) => u.email === "vendor@local-town-runners.example",
)!.id;
const vendor = randomUUID(),
  listing = randomUUID(),
  file = `.local-backend/import-${vendor}.json`;
const data = [
  {
    id: vendor,
    owner_id: owner,
    name: "DEMO Import Test",
    slug: `demo-import-${vendor}`,
    category: "Food",
    public_lon: -91.051234,
    public_lat: 39.448923,
    demo: true,
    website_url: "https://example.com",
    social_urls: [],
    hours: { Friday: "Demo availability only" },
    listings: [
      {
        id: listing,
        title: "DEMO Import Item",
        description: "Local integration fixture",
        category: "Food",
        mode: "SELL",
        price_cents: 450,
        inventory: 12,
        made_local: true,
      },
    ],
  },
];
function run() {
  return spawnSync(
    process.execPath,
    ["--import", "tsx", "scripts/import-vendors.ts", file],
    { env: process.env, encoding: "utf8" },
  ).status;
}
try {
  await writeFile(file, JSON.stringify(data), { mode: 0o600 });
  assert.equal(run(), 0);
  const v = await c
    .from("vendors")
    .select("demo,verified,public_lon,website_url")
    .eq("id", vendor)
    .single();
  if (v.error) throw v.error;
  assert.equal(v.data.demo, true);
  assert.equal(v.data.verified, false);
  assert.equal(Number(v.data.public_lon), -91.05);
  assert.equal(v.data.website_url, "https://example.com");
  assert.equal(run(), 0);
  data[0].owner_id = users.data.users.find(
    (u) => u.email === "runner@local-town-runners.example",
  )!.id;
  await writeFile(file, JSON.stringify(data));
  assert.notEqual(run(), 0);
  console.log(
    "PASS: approved-format JSON import; demo/verified provenance; repeated import; coarsened coordinates; invalid owner rejected. Local fixture only.",
  );
} finally {
  for (const [table, column, id] of [
    ["listings", "id", listing],
    ["vendors", "id", vendor],
    ["audit_events", "resource_id", listing],
    ["audit_events", "resource_id", vendor],
  ]) {
    const r = await c.from(table).delete().eq(column, id);
    if (r.error) throw r.error;
  }
  await unlink(file);
}
