import Link from "next/link";
import Marketplace from "@/components/Marketplace";
import { publicCatalog } from "@/lib/server/catalog";
import { demoEnabled } from "@/lib/server/demo";
export const dynamic = "force-dynamic";
export default async function Home() {
  const [data, canEnterDemo] = await Promise.all([
    publicCatalog().catch(() => null),
    demoEnabled().catch(() => false),
  ]);
  if (!data)
    return (
      <main className="simple-page">
        <h1>The neighborhood is temporarily unavailable.</h1>
        <p>Marketplace data could not be loaded. Please try again shortly.</p>
        <Link href="/">Try again</Link>
      </main>
    );
  return <Marketplace {...data} canEnterDemo={canEnterDemo} />;
}
