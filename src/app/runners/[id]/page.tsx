import Image from "next/image";
import { safeAssetUrl } from "@/lib/assets";
import BlockUser from "@/components/BlockUser";
import Link from "next/link";
import { notFound } from "next/navigation";
import { configured } from "@/lib/server/env";
import { db } from "@/lib/server/db";
import { supabaseConfig } from "@/lib/server/env";
import { demoRunners } from "@/lib/runners";
export default async function RunnerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!configured()) {
    const runner = demoRunners().find((r) => r.id === id);
    if (!runner) notFound();
    return (
      <main className="simple-page">
        <Link href="/">← Explore</Link>
        <h1>{runner.name}</h1>
        <p>
          Illustrative demo runner · Louisiana, Missouri. Temporary availability
          is demo data.
        </p>
      </main>
    );
  }
  const e = supabaseConfig();
  const client = await db(true);
  const { data: r } = await client
    .from("runners")
    .select(
      "id,display_name,bio,categories,available_until,completed_runs,avatar_url,demo,transportation,max_detour_miles",
    )
    .eq("id", id)
    .single();
  if (!r) notFound();
  return (
    <main className="simple-page">
      <Link href="/">← Explore</Link>
      {safeAssetUrl(r.avatar_url, e.url) && (
        <Image
          src={safeAssetUrl(r.avatar_url, e.url)!}
          alt={`${r.display_name} avatar`}
          width={100}
          height={100}
        />
      )}
      {r.demo && <span className="demo-tag">FICTIONAL DEMO RUNNER</span>}
      <h1>{r.display_name}</h1>
      <p>
        Transportation: {r.transportation} · Maximum detour:{" "}
        {r.max_detour_miles} miles.
      </p>
      <p>{r.bio}</p>
      <p>
        Accepts: {r.categories.join(", ")} · {r.completed_runs} completed runs.
      </p>
      <p>Available until {r.available_until}. Exact location is private.</p>
      <BlockUser id={r.id} />
    </main>
  );
}
