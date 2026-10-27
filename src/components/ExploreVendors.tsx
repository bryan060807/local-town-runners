"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Listing, Vendor } from "@/lib/catalog";
import VendorReputation from "./VendorReputation";
import styles from "./ExploreCatalog.module.css";

export default function ExploreVendors({
  vendors,
  listings,
  onBrowse,
}: {
  vendors: Vendor[];
  listings: Listing[];
  onBrowse: (id: string) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(6);
  return (
    <section
      className="vendor-directory"
      aria-labelledby="vendor-directory-heading"
    >
      <div className={styles.directoryHeader}>
        <div>
          <h3 id="vendor-directory-heading">Local vendors</h3>
          <p>Meet the makers, shops and services in your neighborhood.</p>
        </div>
        <span className={styles.resultCount} role="status">
          {vendors.length ? Math.min(visibleCount, vendors.length) : 0} of{" "}
          {vendors.length} vendors
        </span>
      </div>
      <p className={styles.mobileHint}>
        Swipe or scroll to explore vendors <span aria-hidden="true">→</span>
      </p>
      <div
        className={styles.vendorGrid}
        role="region"
        aria-label="Vendor storefront cards"
        tabIndex={vendors.length ? 0 : undefined}
      >
        {vendors.slice(0, visibleCount).map((vendor) => {
          const available = listings.filter(
            (listing) => listing.vendorId === vendor.id,
          );
          const image =
            vendor.coverUrl ||
            vendor.logoUrl ||
            available.find((listing) => listing.photos?.length)?.photos?.[0];
          const imageAlt = vendor.coverUrl
            ? `${vendor.name} cover`
            : vendor.logoUrl
              ? `${vendor.name} logo`
              : `An item from ${vendor.name}`;
          return (
            <article
              key={vendor.id}
              className={`explore-vendor-card ${styles.vendorCard}`}
            >
              <div className={styles.vendorArt}>
                {image ? (
                  <Image
                    src={image}
                    alt={imageAlt}
                    fill
                    sizes="(max-width: 760px) 90vw, (max-width: 1050px) 45vw, 30vw"
                    className={
                      vendor.logoUrl === image ? styles.logo : styles.cover
                    }
                  />
                ) : (
                  <span aria-hidden="true">
                    {vendor.category === "Food"
                      ? "🥐"
                      : vendor.category === "Farm"
                        ? "🌿"
                        : vendor.category === "Services"
                          ? "🛠️"
                          : "🛍️"}
                  </span>
                )}
                <span className={styles.vendorTag}>
                  {vendor.demo ? "FICTIONAL DEMO VENDOR" : vendor.category}
                </span>
              </div>
              <div className={styles.vendorBody}>
                <span className={styles.category}>{vendor.category}</span>
                <h4>{vendor.name}</h4>
                <p className={styles.description}>
                  {vendor.description ||
                    `Discover ${vendor.category.toLowerCase()} from this neighborhood vendor.`}
                </p>
                <VendorReputation
                  reputation={vendor.reputation}
                  demo={vendor.demo}
                />
                <p className={styles.availability}>
                  {available.length
                    ? `${available.length} available ${available.length === 1 ? "find" : "finds"}`
                    : "No available finds right now"}
                </p>
                <div className={styles.vendorActions}>
                  <Link
                    href={`/vendors/${vendor.id}`}
                    aria-label={`Visit ${vendor.name} storefront`}
                  >
                    Visit storefront <ArrowUpRight size={15} />
                  </Link>
                  {available.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onBrowse(vendor.id)}
                      aria-label={`Browse ${vendor.name} items`}
                    >
                      Browse items
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!vendors.length && (
        <p className={styles.emptyVendors}>
          No vendors match these filters. Try another category or a shorter
          search.
        </p>
      )}
      {vendors.length > 6 && (
        <div className={styles.moreVendors}>
          {visibleCount < vendors.length && (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => setVisibleCount((count) => count + 6)}
            >
              Show more vendors
            </button>
          )}
          {visibleCount > 6 && (
            <button
              type="button"
              className={styles.actionButton}
              onClick={() => setVisibleCount(6)}
            >
              Show fewer vendors
            </button>
          )}
        </div>
      )}
    </section>
  );
}
