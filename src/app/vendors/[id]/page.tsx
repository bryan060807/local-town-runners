import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicCatalog } from "@/lib/server/catalog";
import { money } from "@/lib/catalog";
export default async function VendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await publicCatalog();
  const vendor = data.vendors.find((v) => v.id === id);
  if (!vendor) notFound();
  return (
    <main className="simple-page">
      <Link href="/">← Explore your town</Link>
      <div className="eyebrow">
        {vendor.demo
          ? "FICTIONAL DEMO VENDOR"
          : vendor.verified
            ? "APPROVED MARKETPLACE VENDOR"
            : "MARKETPLACE VENDOR"}
      </div>
      {vendor.coverUrl && (
        <Image
          className="vendor-cover"
          src={vendor.coverUrl}
          alt="Vendor cover"
          width={800}
          height={220}
        />
      )}{" "}
      {vendor.logoUrl && (
        <Image
          className="vendor-logo"
          src={vendor.logoUrl}
          alt={`${vendor.name} logo`}
          width={100}
          height={100}
        />
      )}
      <h1>{vendor.name}</h1>
      {vendor.description && <p>{vendor.description}</p>}
      {vendor.websiteUrl && (
        <p>
          <a href={vendor.websiteUrl} target="_blank" rel="noopener noreferrer">
            Business website ↗
          </a>
        </p>
      )}
      {vendor.socialUrls?.map((url) => (
        <p key={url}>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Social profile ↗
          </a>
        </p>
      ))}
      {vendor.hours && Object.keys(vendor.hours).length > 0 && (
        <div className="simple-card">
          <h2>Published availability</h2>
          {Object.entries(vendor.hours).map(([day, hours]) => (
            <p key={day}>
              {day}: {hours}
            </p>
          ))}
        </div>
      )}
      <p>
        {vendor.category} · Louisiana, Missouri. Public location is approximate;
        operational pickup addresses are private.
      </p>
      {data.listings
        .filter((l) => l.vendorId === id)
        .map((l) => (
          <div key={l.id} className="simple-card">
            <Link href={`/listings/${l.id}`}>
              <h2>
                {l.emoji} {l.title} · {money(l.price)}
              </h2>
              <p>{l.description}</p>
            </Link>
          </div>
        ))}
    </main>
  );
}
