import Image from "next/image";
import ReportListing from "@/components/ReportListing";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicCatalog } from "@/lib/server/catalog";
import { money } from "@/lib/catalog";
export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await publicCatalog();
  const l = data.listings.find((l) => l.id === id);
  if (!l) notFound();
  const vendor = data.vendors.find((v) => v.id === l.vendorId)!;
  return (
    <main className="simple-page">
      <Link href="/">← Explore your town</Link>
      <div className="modal-emoji">
        {l.photos?.[0] ? (
          <Image src={l.photos[0]} alt={l.title} width={600} height={400} />
        ) : (
          l.emoji
        )}
      </div>
      <div className="eyebrow">
        {vendor.demo ? "FICTIONAL DEMO VENDOR" : "MARKETPLACE VENDOR"} ·{" "}
        {l.mode}
      </div>
      <h1>{l.title}</h1>
      <p>{l.description}</p>
      <h2>
        {l.mode === "SELL"
          ? `${money(l.price)} · ${l.inventory} available`
          : "Quote required — send an inquiry in the marketplace"}
      </h2>
      <p>
        <Link href={`/vendors/${vendor.id}`}>{vendor.name} →</Link>
      </p>
      <Link className="primary" href="/">
        Choose this item in the marketplace
      </Link>
      {!data.demo && <ReportListing id={l.id} />}
    </main>
  );
}
