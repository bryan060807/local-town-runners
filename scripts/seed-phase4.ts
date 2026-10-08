import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { definitions } from "../src/lib/onboarding/definitions";
const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const ready = await c.rpc("phase4_ready");
if (ready.error || ready.data !== true)
  throw Error("Apply Phase 4 migration first");
const source = await readFile("docs/agreements/VDPCP-original-blank.pdf");
const vendor = {
  kind: "vendor",
  version: "VDPCP-original-2026-10-08",
  title: "Vendor Demo Participation & Content Permission",
  sections: JSON.parse(
    await readFile("docs/agreements/vdpcp-2026-10-08.json", "utf8"),
  ),
};
for (const d of [...definitions, vendor]) {
  const sections = JSON.parse(JSON.stringify(d.sections));
  const existing = await c
    .from("agreement_versions")
    .select("id")
    .eq("kind", d.kind)
    .eq("version", d.version)
    .maybeSingle();
  if (existing.error) throw Error("Agreement read failed");
  if (!existing.data) {
    const other = await c
      .from("agreement_versions")
      .select("id")
      .eq("kind", d.kind)
      .eq("active", true)
      .maybeSingle();
    if (other.data)
      throw Error("Existing active version requires operator review");
    const r = await c.from("agreement_versions").insert({
      ...d,
      sections,
      source_sha256: createHash("sha256")
        .update(d.kind === "vendor" ? source : JSON.stringify(sections))
        .digest("hex"),
      active: true,
    });
    if (r.error) throw Error("Agreement seed failed");
  }
}
console.log(
  "Vendor original 12-section VDPCP, customer and runner versions ready. No real vendor content was seeded.",
);
