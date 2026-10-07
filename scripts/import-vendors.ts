import { z } from "zod";
import { readFile } from "node:fs/promises";
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
  })
  .strict();
const schema = z.array(
  z
    .object({
      id: z.uuid(),
      owner_id: z.uuid(),
      name: z.string().min(1).max(150),
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
const rows = schema.parse(JSON.parse(await readFile(process.argv[2], "utf8")));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw Error("Supabase server credentials required");
const c = createClient(url, key, { auth: { persistSession: false } });
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
      active: true,
      prohibited: false,
    })),
  );
  if (r.error) throw r.error;
}
console.log(
  `Imported ${rows.length} validated vendors. Private pickup addresses are managed separately.`,
);
