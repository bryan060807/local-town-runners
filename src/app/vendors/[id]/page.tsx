import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicCatalog } from "@/lib/server/catalog";
import { money } from "@/lib/catalog";
import VendorReputation from "@/components/VendorReputation";
import styles from "./VendorPage.module.css";
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
      <div className="simple-card">
        <VendorReputation reputation={vendor.reputation} demo={vendor.demo} />
        <details>
          <summary>About vendor reputation</summary>
          <p>
            Ratings come from customers’ completed, paid orders. Community
            favorite requires at least five different reviewers and an average
            of 4.5 or higher. Sponsored placement is separate from earned
            reputation.
          </p>
          <p>
            Review the listing details, keep payments in the app and confirm
            receipt before completing your order.
          </p>
        </details>
      </div>
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
      <ul className={styles.listings} aria-label="Products and services">
        {data.listings
          .filter((l) => l.vendorId === id)
          .map((l) => (
            <li key={l.id}>
              <Link
                className={styles.listing}
                href={`/listings/${l.id}`}
                aria-labelledby={`listing-title-${l.id}`}
                aria-describedby={`listing-price-${l.id}`}
              >
                <div className={styles.thumbnail}>
                  {l.photos?.[0] ? (
                    <Image
                      className={styles.photo}
                      src={l.photos[0]}
                      alt={l.title}
                      fill
                      sizes="(max-width: 480px) 80px, 112px"
                    />
                  ) : (
                    <span className={styles.emoji} aria-hidden="true">
                      {l.emoji}
                    </span>
                  )}
                </div>
                <div className={styles.details}>
                  <h2 id={`listing-title-${l.id}`}>{l.title}</h2>
                  <p className={styles.description}>{l.description}</p>
                  <div className={styles.meta}>
                    <strong id={`listing-price-${l.id}`}>
                      {l.mode === "SELL" ? money(l.price) : "Quote required"}
                    </strong>
                    {l.mode === "SELL" && <span>{l.inventory} available</span>}
                    <span className={styles.view}>View item →</span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
      </ul>
    </main>
  );
}
