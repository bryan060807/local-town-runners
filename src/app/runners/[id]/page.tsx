import Image from "next/image";
import { safeAssetUrl } from "@/lib/assets";
import BlockUser from "@/components/BlockUser";
import Link from "next/link";
import { notFound } from "next/navigation";
import { configured } from "@/lib/server/env";
import { createClient } from "@supabase/supabase-js";
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
  const client = createClient(e.url, e.key);
  const { data: r } = await client
    .from("runners")
    .select(
      "id,display_name,bio,categories,available_until,completed_runs,avatar_url",
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
      <h1>{r.display_name}</h1>
      <p>{r.bio}</p>
      <p>
        Accepts: {r.categories.join(", ")} · {r.completed_runs} completed runs.
      </p>
      <p>Available until {r.available_until}. Exact location is private.</p>
      <BlockUser id={r.id} />
    </main>
  );
}
