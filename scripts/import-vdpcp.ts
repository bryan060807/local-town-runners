import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { agreementSections } from "../src/lib/onboarding/schema";
const [file, version] = process.argv.slice(2);
if (!file || !version)
  throw Error("Usage: import-vdpcp.ts exact-source.json VERSION");
const bytes = await readFile(file);
const sections = agreementSections.parse(JSON.parse(bytes.toString()));
if (sections.length !== 12)
  throw Error("VDPCP requires all 12 original sections");
const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const current = await c
  .from("agreement_versions")
  .select("id")
  .eq("kind", "vendor")
  .eq("active", true)
  .maybeSingle();
if (current.error || current.data)
  throw Error(
    "Deactivate existing version explicitly before publishing a new version",
  );
const r = await c
  .from("agreement_versions")
  .insert({
    kind: "vendor",
    version,
    title: "Vendor Demo Participation & Content Permission",
    sections,
    source_sha256: createHash("sha256").update(bytes).digest("hex"),
    active: true,
  });
if (r.error) throw Error("VDPCP import failed");
console.log(
  "Exact 12-section VDPCP version imported; no source text or private signatures logged.",
);
