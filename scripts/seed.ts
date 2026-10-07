import { createClient } from "@supabase/supabase-js";
import { vendors, listings } from "../src/lib/catalog";
if (process.env.NODE_ENV === "production")
  throw Error("Demo seeding is disabled in production");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY,
  password = process.env.DEMO_SEED_PASSWORD;
if (!url || !key || !password || password.length < 12)
  throw Error(
    "Set Supabase URL, service role key and DEMO_SEED_PASSWORD (12+ characters) in the local environment",
  );
const client = createClient(url, key, { auth: { persistSession: false } });
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function checked<T extends { error: unknown }>(p: PromiseLike<T>) {
  const r = await p;
  if (r.error) throw r.error;
  return r;
}
async function account(
  role: string,
  index: number,
  label = role,
  name = role === "runner" ? "Bryan" : `Demo ${role}`,
) {
  const email = `${label}@local-town-runners.example`;
  const created = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  let id = created.data.user?.id;
  if (created.error) {
    const result = await client.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (result.error) throw result.error;
    id = result.data.users.find((u) => u.email === email)?.id;
    if (!id) throw created.error;
  }
  await checked(
    client.from("profiles").update({ display_name: name }).eq("id", id!),
  );
  await checked(client.from("user_roles").upsert({ user_id: id, role }));
  if (role === "runner")
    await checked(
      client.from("runners").upsert({
        id,
        demo: true,
        display_name: name,
        public_lon: -91.05,
        public_lat: 39.45,
        available_until: new Date(Date.now() + 3600000).toISOString(),
        categories: ["Food", "Shops", "Gifts"],
        visible: true,
        max_detour_miles: 3,
      }),
    );
  return { id: id!, index };
}
const accounts = {
  customer: await account("customer", 1),
  vendor: await account("vendor", 2),
  runner: await account("runner", 3),
  admin: await account("admin", 4),
  sarah: await account("runner", 5, "runner-sarah", "Sarah"),
  jordan: await account("runner", 6, "runner-jordan", "Jordan"),
};
for (let i = 0; i < vendors.length; i++) {
  const v = vendors[i];
  await checked(
    client.from("vendors").upsert({
      id: uid(i + 1),
      owner_id: accounts.vendor.id,
      name: v.name,
      slug: v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      category: v.category,
      public_lon: v.coordinates[0],
      public_lat: v.coordinates[1],
      demo: true,
      verified: false,
    }),
  );
  const l = listings[i];
  const { data: existing, error: readError } = await client
    .from("listings")
    .select("id")
    .eq("id", uid(101 + i))
    .maybeSingle();
  if (readError) throw readError;
  const row = {
    id: uid(101 + i),
    vendor_id: uid(i + 1),
    title: l.title,
    description: l.description,
    category: l.category,
    mode: l.mode,
    price_cents: l.price,
    made_local: l.local,
    active: true,
    prohibited: false,
    emoji: l.emoji,
  };
  await checked(
    existing
      ? client.from("listings").update(row).eq("id", row.id)
      : client.from("listings").insert({ ...row, inventory: l.inventory }),
  );
}
await checked(
  client.from("runner_trips").upsert({
    id: uid(500),
    runner_id: accounts.runner.id,
    destination_vendor_id: uid(1),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    note: "Already heading toward the demo bakery",
  }),
);
console.log(
  "Seeded 15 DEMO vendors and listings. Demo account emails use local-town-runners.example. Password was supplied securely through DEMO_SEED_PASSWORD. Existing orders and inventory counters were preserved.",
);
