"use client";

import { useState } from "react";
import { money } from "@/lib/catalog";
import VendorEditor, {
  VendorListingValues,
  VendorSaveFeedback,
} from "./VendorEditor";

type CatalogListing = VendorListingValues & {
  id: string;
  vendorId: string;
  title: string;
  category: string;
};
const pageSize = 10;

export default function VendorCatalog({
  listings,
  vendors,
}: {
  listings: CatalogListing[];
  vendors: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Record<string, VendorListingValues>>({});
  const [drafts, setDrafts] = useState<Record<string, VendorListingValues>>({});
  const [feedback, setFeedback] = useState<Record<string, VendorSaveFeedback>>(
    {},
  );
  const [message, setMessage] = useState("");
  const vendorNames = new Map(
    vendors.map((vendor) => [vendor.id, vendor.name]),
  );
  const categories = [
    ...new Set(listings.map((listing) => listing.category)),
  ].sort();
  const items = listings.map((listing) => ({
    ...listing,
    ...saved[listing.id],
  }));
  const search = query.trim().toLocaleLowerCase();
  const filtered = items
    .filter(
      (listing) =>
        (!search ||
          `${listing.title} ${listing.category} ${vendorNames.get(listing.vendorId) || ""}`
            .toLocaleLowerCase()
            .includes(search)) &&
        (!category || listing.category === category) &&
        (!vendorId || listing.vendorId === vendorId) &&
        (!status ||
          (status === "active" && listing.active) ||
          (status === "inactive" && !listing.active) ||
          (status === "empty" && listing.inventory === 0)),
    )
    .sort(
      (a, b) =>
        (sort === "price"
          ? a.price - b.price
          : sort === "stock"
            ? a.inventory - b.inventory
            : 0) ||
        a.title.localeCompare(b.title) ||
        a.id.localeCompare(b.id),
    );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * pageSize;
  const visible = filtered.slice(start, start + pageSize);
  const hasFilters = !!(query || category || vendorId || status);

  function clearFilters() {
    setQuery("");
    setCategory("");
    setVendorId("");
    setStatus("");
    setPage(1);
  }

  return (
    <div className="vendor-catalog">
      <p>Select an item to edit its price, stock or photo.</p>
      <div className="vendor-catalog-toolbar">
        <label className="vendor-catalog-search">
          Search your catalog
          <input
            type="search"
            placeholder="Find an item…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="vendor-catalog-filters">
          <label>
            Category
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All categories</option>
              {categories.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {vendors.length > 1 && (
            <label>
              Storefront
              <select
                value={vendorId}
                onChange={(event) => {
                  setVendorId(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All storefronts</option>
                {vendors.map((vendor) => (
                  <option value={vendor.id} key={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Listing status
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All listings</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="empty">Out of stock</option>
            </select>
          </label>
          <label>
            Sort listings
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="name">Name: A–Z</option>
              <option value="price">Price: low to high</option>
              <option value="stock">Stock: low to high</option>
            </select>
          </label>
        </div>
      </div>
      <div className="vendor-catalog-results">
        <p role="status">
          {filtered.length
            ? `${start + 1}–${Math.min(start + pageSize, filtered.length)} of ${filtered.length}`
            : "0"}
          {hasFilters
            ? ` matching listings · ${items.length} total`
            : ` listings`}
        </p>
        {hasFilters && (
          <button type="button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>
      <p className="vendor-catalog-feedback" role="status">
        {message}
      </p>
      {!visible.length && (
        <div className="vendor-catalog-empty">
          {items.length
            ? "No listings match your filters. Try a different search or clear the filters."
            : "Your catalog is empty. Use Add a listing above to create your first item."}
        </div>
      )}
      <ul className="vendor-catalog-list">
        {visible.map((listing) => {
          const expanded = expandedId === listing.id;
          const editorId = `catalog-editor-${listing.id}`;
          return (
            <li className="vendor-catalog-row" key={listing.id}>
              <div className="vendor-catalog-summary">
                <div className="vendor-catalog-item">
                  <button
                    type="button"
                    className="vendor-catalog-title"
                    aria-expanded={expanded}
                    aria-controls={editorId}
                    aria-label={
                      expanded
                        ? `Close editor for ${listing.title}`
                        : `Edit ${listing.title}`
                    }
                    onClick={() => setExpandedId(expanded ? null : listing.id)}
                  >
                    {listing.title}
                    <span aria-hidden="true">{expanded ? "−" : "+"}</span>
                  </button>
                  <div className="vendor-catalog-meta">
                    {listing.category}
                    {vendors.length > 1 &&
                      ` · ${vendorNames.get(listing.vendorId) || ""}`}
                  </div>
                </div>
                <strong className="vendor-catalog-price">
                  {money(listing.price)}
                </strong>
                <div className="vendor-catalog-stock">
                  <span>
                    {listing.inventory === 0
                      ? "Out of stock"
                      : `${listing.inventory} in stock`}
                  </span>
                  <span
                    className={`vendor-catalog-badge ${listing.active ? "is-active" : ""}`}
                  >
                    {listing.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
              <div id={editorId} hidden={!expanded}>
                {expanded && (
                  <VendorEditor
                    id={listing.id}
                    vendorId={listing.vendorId}
                    title={listing.title}
                    values={drafts[listing.id] || listing}
                    feedback={
                      feedback[listing.id] || { pending: false, message: "" }
                    }
                    onFeedbackChange={(value) => {
                      setFeedback((previous) => ({
                        ...previous,
                        [listing.id]: value,
                      }));
                      if (value.message)
                        setMessage(`${listing.title}: ${value.message}`);
                    }}
                    onChange={(values) =>
                      setDrafts((previous) => ({
                        ...previous,
                        [listing.id]: values,
                      }))
                    }
                    onSaved={(values) => {
                      setSaved((previous) => ({
                        ...previous,
                        [listing.id]: values,
                      }));
                    }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {pageCount > 1 && (
        <nav className="vendor-catalog-pagination" aria-label="Catalog pages">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous page
          </button>
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Next page
          </button>
        </nav>
      )}
    </div>
  );
}
