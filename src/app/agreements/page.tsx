import Link from "next/link";
import { db } from "@/lib/server/db";
export const dynamic = "force-dynamic";
export default async function Page() {
  const c = await db(true);
  const { data } = await c
    .from("agreement_versions")
    .select("id,title,version,sections")
    .eq("active", true);
  return (
    <main className="simple-page onboarding-page">
      <Link href="/">← Marketplace</Link>
      <h1>Current agreements</h1>
      {data?.map((a) => (
        <article key={a.id}>
          <h2>{a.title}</h2>
          <p>Version {a.version}</p>
          {(a.sections as { heading: string; text: string }[]).map((s, i) => (
            <section className="agreement-section" key={i}>
              <h3>{s.heading}</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{s.text}</p>
            </section>
          ))}
        </article>
      ))}
      <p>
        Signing records the exact accepted version; updated terms require new
        consent.
      </p>
    </main>
  );
}
