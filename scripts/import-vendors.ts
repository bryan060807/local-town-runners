import { z } from "zod";
import { readFile, stat } from "node:fs/promises";
import { safeAssetUrl } from "../src/lib/assets";
import { createClient } from "@supabase/supabase-js";
const listing = z
  .object({
    id: z.uuid(),
    title: z.string().min(1).max(150),
    description: z.string().max(2000),
    category: z.enum(["Food", "Gifts", "Makers", "Farm", "Shops", "Services"]),
    mode: z.enum(["SELL", "MAKE", "DO"]),
    price_cents: z.number().int().min(0).max(10000000),
    inventory: z.number().int().min(0),
    made_local: z.boolean(),
    active: z.boolean().default(true),
    photos: z.array(z.url()).max(8).default([]),
  })
  .strict();
const schema = z.array(
  z
    .object({
      id: z.uuid(),
      owner_id: z.uuid(),
      name: z.string().min(1).max(150),
      description: z.string().max(2000).default(""),
      hours: z.record(z.string(), z.string().max(200)).default({}),
      service_area: z.string().max(500).default("Louisiana, Missouri"),
      website_url: z
        .url()
        .refine((v) => new URL(v).protocol === "https:")
        .optional(),
      social_urls: z
        .array(z.url().refine((v) => new URL(v).protocol === "https:"))
        .max(5)
        .default([]),
      slug: z.string().regex(/^[a-z0-9-]+$/),
      category: z.string().min(1).max(40),
      public_lon: z.number().min(-180).max(180),
      public_lat: z.number().min(-90).max(90),
      demo: z.boolean(),
      approvalReference: z.string().min(1).optional(),
      listings: z.array(listing),
    })
    .strict()
    .refine(
      (v) => v.demo || Boolean(v.approvalReference),
      "Real vendors require an approval reference",
    ),
);
if (!process.argv[2])
  throw Error("Usage: npm run import:vendors -- approved-vendors.json");
if ((await stat(process.argv[2])).size > 2000000)
  throw Error("Import file exceeds 2 MB");
const rows = schema
  .min(1)
  .max(100)
  .parse(JSON.parse(await readFile(process.argv[2], "utf8")));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw Error("Supabase server credentials required");
const c = createClient(url, key, { auth: { persistSession: false } });
// Validate the entire batch before the first write. Imports must not transfer ownership.
const ids = new Set<string>();
for (const row of rows) {
  if (ids.has(row.id)) throw Error("Duplicate vendor ID");
  ids.add(row.id);
  const { data: role, error: roleError } = await c
    .from("user_roles")
    .select("role")
    .eq("user_id", row.owner_id)
    .eq("role", "vendor")
    .maybeSingle();
  if (roleError || !role)
    throw Error("Owner must have administrator-provisioned vendor membership");
  const { data: existing, error: existingError } = await c
    .from("vendors")
    .select("owner_id")
    .eq("id", row.id)
    .maybeSingle();
  if (existingError || (existing && existing.owner_id !== row.owner_id))
    throw Error("Import cannot transfer an existing vendor owner");
  for (const l of row.listings) {
    if (ids.has(l.id)) throw Error("Duplicate listing ID");
    ids.add(l.id);
    if (l.photos.some((photo) => !safeAssetUrl(photo, url)))
      throw Error(
        "Photos must be sanitized marketplace-assets URLs from this project",
      );
    const { data: old, error: oldError } = await c
      .from("listings")
      .select("vendor_id")
      .eq("id", l.id)
      .maybeSingle();
    if (oldError || (old && old.vendor_id !== row.id))
      throw Error("Import cannot move an existing listing between vendors");
  }
}
for (const { listings, approvalReference, ...vendor } of rows) {
  const { error } = await c.from("vendors").upsert({
    ...vendor,
    verified: !vendor.demo && Boolean(approvalReference),
    active: true,
  });
  if (error) throw error;
  const r = await c.from("listings").upsert(
    listings.map((l) => ({
      ...l,
      vendor_id: vendor.id,
      prohibited: false,
    })),
  );
  if (r.error) throw r.error;
  const audit = await c.from("audit_events").insert({
    event: vendor.demo ? "DEMO_VENDOR_IMPORTED" : "APPROVED_VENDOR_IMPORTED",
    resource_id: vendor.id,
  });
  if (audit.error) throw audit.error;
}
console.log(
  `Imported ${rows.length} validated vendors. Private pickup addresses are managed separately.`,
);
