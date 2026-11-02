import "server-only";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { money } from "@/lib/catalog";
import { publicVendorShowcase } from "@/lib/server/vendor-showcase";
import type { ShowcaseBusiness } from "@/lib/vendor-showcase";
import styles from "./ParticipatingVendors.module.css";

function BusinessPreview({ business }: { business: ShowcaseBusiness }) {
  return (
    <details className={styles.business}>
      <summary
        className={styles.summary}
        aria-label={`Preview ${business.name}`}
      >
        <span className={styles.art}>
          {business.photoUrl ? (
            <Image
              className={styles.photo}
              src={business.photoUrl}
              alt={`${business.name} preview`}
              fill
              sizes="(max-width: 480px) 64px, 80px"
            />
          ) : (
            <span className={styles.emoji} aria-hidden="true">
              {business.category === "Food"
                ? "🥐"
                : business.category === "Farm"
                  ? "🌿"
                  : business.category === "Services"
                    ? "🛠️"
                    : "🛍️"}
            </span>
          )}
        </span>
        <span className={styles.identity}>
          <span className={styles.category}>{business.category}</span>
          <strong className={styles.name}>{business.name}</strong>
          {business.description && (
            <span className={styles.description}>{business.description}</span>
          )}
          <span className={styles.action} aria-hidden="true">
            View listings <ChevronDown className={styles.arrow} size={16} />
          </span>
        </span>
      </summary>
      <div className={styles.contents}>
        {business.listings.length ? (
          <ul
            className={styles.listings}
            aria-label={`${business.name} public listings`}
          >
            {business.listings.map((listing) => (
              <li key={listing.id} className={styles.listing}>
                {listing.photoUrl && (
                  <div className={styles.itemArt}>
                    <Image
                      className={styles.photo}
                      src={listing.photoUrl}
                      alt={listing.title}
                      fill
                      sizes="64px"
                    />
                  </div>
                )}
                <div className={styles.itemCopy}>
                  <h3 className={styles.itemTitle}>{listing.title}</h3>
                  {listing.description && <p>{listing.description}</p>}
                  <span className={styles.price}>
                    {listing.mode === "SELL"
                      ? money(listing.priceCents)
                      : "Quote required"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.notice}>
            No public listings are available to preview right now.
          </p>
        )}
        <p className={styles.previewNote}>
          Public showcase only. Demo shopping uses the fictional catalog.
        </p>
      </div>
    </details>
  );
}

export default async function ParticipatingVendors() {
  const showcase = await publicVendorShowcase();
  if (showcase.status === "disabled") return null;
  return (
    <section
      className={styles.shell}
      id="participating-businesses"
      aria-labelledby="participating-businesses-heading"
    >
      <div className={styles.heading}>
        <div>
          <span className={styles.badge}>SHOWCASE ONLY</span>
          <h2 className={styles.title} id="participating-businesses-heading">
            Participating local businesses
          </h2>
        </div>
        {showcase.status === "ready" && showcase.businesses.length > 0 && (
          <span className={styles.count}>
            {showcase.businesses.length}{" "}
            {showcase.businesses.length === 1 ? "business" : "businesses"}
          </span>
        )}
      </div>
      <p className={styles.intro}>
        These are real businesses and their public listings. Expand a preview to
        explore their products and services. Demo orders and Sidekick plans
        still use the fictional catalog.
      </p>
      {showcase.status === "unavailable" ? (
        <p className={styles.notice} role="status">
          Local business previews are temporarily unavailable. You can keep
          exploring the fictional demo catalog below.
        </p>
      ) : showcase.businesses.length ? (
        <>
          <div className={styles.grid}>
            {showcase.businesses.map((business) => (
              <BusinessPreview key={business.id} business={business} />
            ))}
          </div>
          <p className={styles.note}>
            {showcase.hasMore
              ? "Showing a selection of participating businesses. "
              : ""}
            Each preview includes up to three public listings.
          </p>
        </>
      ) : (
        <p className={styles.notice}>
          No participating businesses are available to preview right now.
        </p>
      )}
    </section>
  );
}
