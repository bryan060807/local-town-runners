"use client";
import Image from "next/image";
import { demoAddress } from "@/lib/demo-catalog";
import Link from "next/link";
import { PublicRunner } from "@/lib/map-types";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  ArrowUpRight,
  ArrowUp,
  Search,
  MapPin,
  ShoppingBag,
  Compass,
  ChevronRight,
  Leaf,
  Route,
  X,
  Plus,
  Minus,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { Listing, Vendor, money } from "@/lib/catalog";
import ExploreVendors from "./ExploreVendors";
import styles from "./ExploreCatalog.module.css";
const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => (
    <div className="map-shell loading">Loading your neighborhood…</div>
  ),
});
const categories = [
  "All",
  "Food",
  "Gifts",
  "Makers",
  "Farm",
  "Shops",
  "Services",
];
export default function Marketplace({
  listings,
  vendors,
  runners,
  demo,
  isolatedDemo = false,
}: {
  listings: Listing[];
  vendors: Vendor[];
  runners: PublicRunner[];
  demo: boolean;
  isolatedDemo?: boolean;
}) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [storefront, setStorefront] = useState<string | null>(null);
  const [category, setCategory] = useState("All");
  const [localOnly, setLocalOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [browseAll, setBrowseAll] = useState(false);
  const [itemPage, setItemPage] = useState(1);
  const findsHeading = useRef<HTMLHeadingElement>(null);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [quantity, setQuantity] = useState(1);
  const dialogRoot = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = dialogRoot.current;
    root?.querySelector<HTMLElement>("button")?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        return;
      }
      if (e.key === "Tab" && root) {
        const elements = [
          ...root.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a,input,select,textarea,[tabindex="0"]',
          ),
        ];
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [selected]);
  const [address, setAddress] = useState(isolatedDemo ? demoAddress : "");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState(
    "Ask me what’s good, what’s local, or who’s already heading your way.",
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [matchedRunnerId, setMatchedRunnerId] = useState<string | undefined>();
  const [conversationListing, setConversationListing] = useState<
    string | undefined
  >();
  const [preparing, setPreparing] = useState(false);
  const requestKey = useRef<string | undefined>(undefined);
  const requestPayload = useRef("");
  const [recommendations, setRecommendations] = useState<Listing[]>([]);
  const selectVendor = useCallback(
    (id: string) => {
      setSelected(listings.find((l) => l.vendorId === id) || null);
      setQuantity(1);
      setNotice("");
    },
    [listings],
  );
  async function ask(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          previousListing:
            selected?.id || conversationListing || recommendations[0]?.id,
          resultIds: recommendations.map((l) => l.id),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setReply(data.text);
      setHighlight(data.vendorIds);
      setRecommendations(data.listings);
      setMatchedRunnerId(data.matchedRunnerId);
      if (data.listings?.length) setConversationListing(data.listings[0].id);
      if (data.prepared) {
        const l = listings.find((l) => l.id === data.prepared.listingId);
        if (l) {
          setSelected(l);
          setQuantity(data.prepared.quantity);
          setNotice(data.text);
        }
      }
    } catch (e) {
      setReply(
        e instanceof Error
          ? e.message
          : "Assistant unavailable. Try search instead.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    if (!selected || preparing) return;
    setPreparing(true);
    const payload = JSON.stringify([selected.id, quantity, address]);
    if (requestPayload.current !== payload) {
      requestKey.current = crypto.randomUUID();
      requestPayload.current = payload;
    }
    try {
      const res = await fetch(demo ? "/api/prepare" : "/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: selected.id,
          quantity,
          ...(!demo
            ? { requestId: requestKey.current, deliveryAddress: address }
            : {}),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw Error(d.error);
      if (d.order) {
        router.push("/dashboard?prepared=" + d.order.id);
        return;
      }
      setNotice(`${d.formatted} · ${d.message}`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not prepare order");
    } finally {
      setPreparing(false);
    }
  }
  async function addToCart() {
    if (!selected || preparing) return;
    setPreparing(true);
    try {
      const r = await fetch(
        selected.mode === "SELL" ? "/api/cart" : "/api/inquiries",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            selected.mode === "SELL"
              ? { listingId: selected.id, quantity }
              : {
                  listingId: selected.id,
                  message: `Please share availability and a quote for ${selected.title}.`,
                },
          ),
        },
      );
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      if (selected.mode === "SELL") router.push("/cart");
      else
        setNotice(
          "Inquiry sent to the vendor. No order or payment was created.",
        );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Action unavailable");
    } finally {
      setPreparing(false);
    }
  }
  const vendorNames = new Map(
    vendors.map((vendor) => [vendor.id, vendor.name]),
  );
  const availableListings = listings.filter(
    (listing) => listing.active && listing.inventory > 0,
  );
  const search = query.trim().toLowerCase();
  const shown = availableListings.filter(
    (l) =>
      (!storefront || l.vendorId === storefront) &&
      (!localOnly || l.local) &&
      (category === "All" || l.category === category) &&
      `${l.title} ${l.description} ${vendorNames.get(l.vendorId) || ""}`
        .toLowerCase()
        .includes(search),
  );
  const shownVendors = vendors.filter((vendor) => {
    const vendorListings = availableListings.filter(
      (listing) => listing.vendorId === vendor.id,
    );
    return (
      (!storefront || vendor.id === storefront) &&
      (category === "All" ||
        vendor.category === category ||
        vendorListings.some((listing) => listing.category === category)) &&
      (!localOnly ||
        vendorListings.some(
          (listing) =>
            listing.local &&
            (category === "All" || listing.category === category),
        )) &&
      (!search ||
        `${vendor.name} ${vendor.category} ${vendor.description || ""}`
          .toLowerCase()
          .includes(search) ||
        shown.some((listing) => listing.vendorId === vendor.id))
    );
  });
  const hasFilters = Boolean(
    storefront || localOnly || category !== "All" || search,
  );
  const showFullCatalog = browseAll || hasFilters;
  const pageSize = 12;
  const itemPageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentItemPage = Math.min(itemPage, itemPageCount);
  // Rotate through vendors before taking a second item from the same shop.
  // This is an available-catalog sample, with no paid placement or rating weight.
  const featured: Listing[] = [];
  const featuredVendorIds = new Set<string>();
  for (const listing of shown) {
    if (!featuredVendorIds.has(listing.vendorId)) {
      featured.push(listing);
      featuredVendorIds.add(listing.vendorId);
    }
    if (featured.length === 4) break;
  }
  if (featured.length < 4) {
    featured.push(
      ...shown
        .filter((listing) => !featured.includes(listing))
        .slice(0, 4 - featured.length),
    );
  }
  const visibleItems = showFullCatalog
    ? shown.slice((currentItemPage - 1) * pageSize, currentItemPage * pageSize)
    : featured;
  function browseVendor(id: string) {
    setStorefront(id);
    setCategory("All");
    setLocalOnly(false);
    setQuery("");
    setItemPage(1);
  }
  function changeItemPage(page: number) {
    setItemPage(page);
    requestAnimationFrame(() => {
      findsHeading.current?.focus({ preventScroll: true });
      findsHeading.current?.scrollIntoView({ block: "start" });
    });
  }
  return (
    <>
      <header inert={Boolean(selected)} className="header">
        <Link className="brand" href="/">
          <span className="brand-icon">
            <Route size={22} />
          </span>
          {brand.name}
          <span className="beta">EARLY ACCESS</span>
        </Link>
        <nav>
          <Link className="active" href="#explore">
            Explore
          </Link>
          <Link
            href="#local"
            onClick={() => {
              setLocalOnly(true);
              setItemPage(1);
            }}
          >
            Made local
          </Link>
          <Link href="/dashboard">For neighbors</Link>
        </nav>
        <Link className="sign-in" href="/login">
          Sign in <ArrowUpRight size={16} />
        </Link>
      </header>
      <main inert={Boolean(selected)}>
        <section className="intro">
          <div>
            <div className="eyebrow">
              <span className="pulse" /> YOUR NEIGHBORHOOD, CONNECTED
            </div>
            <h1>
              Good things.
              <br />
              <span>Close to home.</span>
            </h1>
            <p>
              Discover the makers, meals, and everyday magic around you.
              <br className="desktop" /> Let a neighbor bring it your way.
            </p>
          </div>
          <div className="town-note">
            <MapPin size={18} />
            <span>
              {brand.town}
              <small>A little town. A lot to discover.</small>
            </span>
            <span className="town-code">
              39.45° N<br />
              91.05° W
            </span>
          </div>
        </section>
        <section id="explore" className="explore">
          <div className="section-top">
            <h2>
              <Compass size={20} /> Explore your town
            </h2>
            <span className="live">
              <span className="pulse" />{" "}
              {demo ? "Offline demo catalog" : "Connected marketplace"}
            </span>
          </div>
          <div className="explore-grid">
            <WorldMap
              runners={runners}
              vendors={vendors}
              highlight={highlight}
              matchedRunnerId={matchedRunnerId}
              onSelect={selectVendor}
            />
            <aside className="assistant">
              <div className="assistant-heading">
                <span className="ai-mark">✦</span>
                <div>
                  Your local sidekick
                  <small>Good at finding the good stuff.</small>
                </div>
                <span className="online" />
              </div>
              <div className="assistant-body">
                <span className="eyebrow">LET’S LOOK AROUND</span>
                <h3>
                  What brings you
                  <br />
                  around today?
                </h3>
                <p>
                  Recommendations use current catalog prices and availability.
                </p>
                <div className="suggestions">
                  {[
                    "I'm hungry. What's good?",
                    "A birthday gift under $40",
                    "Who has cinnamon rolls?",
                  ].map((s) => (
                    <button disabled={!hydrated} key={s} onClick={() => ask(s)}>
                      {s}
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
                <div className="reply" role="status">
                  {busy ? "Looking around the neighborhood…" : reply}
                </div>
                {recommendations.length > 0 && (
                  <div className="mini-results">
                    {recommendations.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => {
                          setHighlight([l.vendorId]);
                          setConversationListing(l.id);
                          setSelected(l);
                          setQuantity(1);
                          setNotice("");
                        }}
                      >
                        {l.emoji} {l.title}{" "}
                        <strong>
                          {l.mode === "SELL"
                            ? money(l.price)
                            : "Quote required"}
                        </strong>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <form
                className="ask"
                onSubmit={(e) => {
                  e.preventDefault();
                  ask(message);
                }}
              >
                <input
                  aria-label="Ask your local sidekick"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Ask something local…"
                  maxLength={1000}
                />
                <button
                  aria-label="Send message"
                  disabled={busy || !message.trim()}
                >
                  <ArrowUp size={18} />
                </button>
              </form>
              <div className="ai-foot">
                ✦ Catalog-grounded discovery · server validated
              </div>
            </aside>
          </div>
          <div className="map-footer">
            <span>
              <span className="legend vendor" /> {vendors.length} vendors{" "}
              <span className="legend runner" /> {runners.length}{" "}
              {demo ? "illustrative" : "available"} runners
            </span>
            <span>Demo vendors are fictional. Real Louisiana geography.</span>
          </div>
        </section>
        <section id="local" className="catalog">
          {storefront && (
            <p>
              Viewing {vendors.find((v) => v.id === storefront)?.name}{" "}
              <button
                className={styles.textButton}
                onClick={() => {
                  setStorefront(null);
                  setItemPage(1);
                }}
              >
                Show all vendors
              </button>
            </p>
          )}
          <div className="section-top">
            <div>
              <div className="eyebrow">THE NEIGHBORS BEHIND THE FINDS</div>
              <h2>Small town. Good neighbors.</h2>
            </div>
            <button
              aria-pressed={localOnly}
              onClick={() => {
                setLocalOnly((v) => !v);
                setItemPage(1);
              }}
              className="local-stamp"
            >
              <Leaf size={15} /> MADE LOCAL
            </button>
          </div>
          <div className="filters">
            <div className="tabs">
              {categories.map((c) => (
                <button
                  className={category === c ? "selected" : ""}
                  key={c}
                  aria-pressed={category === c}
                  onClick={() => {
                    setCategory(c);
                    setItemPage(1);
                  }}
                >
                  {c === "All" ? "Everything" : c}
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={16} />
              <input
                aria-label="Search listings"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setItemPage(1);
                }}
                placeholder="Find a vendor or something good"
              />
            </label>
          </div>
          <ExploreVendors
            key={`${storefront || ""}:${category}:${localOnly}:${query}`}
            vendors={shownVendors}
            listings={availableListings}
            onBrowse={browseVendor}
          />
          <section className={styles.finds} aria-labelledby="finds-heading">
            <div className={styles.findsHeader}>
              <div>
                <h3 id="finds-heading" ref={findsHeading} tabIndex={-1}>
                  {hasFilters
                    ? "Matching finds"
                    : browseAll
                      ? "All local finds"
                      : "Featured finds"}
                </h3>
                <p>
                  {showFullCatalog
                    ? "Explore available items and services from the vendors around you."
                    : "A small selection from the current catalog. Explore a storefront for more."}
                </p>
              </div>
              {!showFullCatalog ? (
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => {
                    setBrowseAll(true);
                    setItemPage(1);
                  }}
                >
                  Browse all items <ArrowUpRight size={15} />
                </button>
              ) : (
                !hasFilters && (
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => {
                      setBrowseAll(false);
                      setItemPage(1);
                    }}
                  >
                    Back to featured finds
                  </button>
                )
              )}
            </div>
            {showFullCatalog && (
              <p className={styles.resultCount} role="status">
                {shown.length
                  ? `${(currentItemPage - 1) * pageSize + 1}–${Math.min(currentItemPage * pageSize, shown.length)} of ${shown.length}`
                  : "0"}{" "}
                available finds
              </p>
            )}
            <div className="cards">
              {visibleItems.map((l, i) => (
                <button
                  className="product"
                  disabled={!hydrated}
                  key={l.id}
                  onClick={() => {
                    setSelected(l);
                    setQuantity(1);
                    setNotice("");
                    setHighlight([l.vendorId]);
                  }}
                >
                  <div className={`product-art art-${i % 5}`}>
                    {l.photos?.[0] ? (
                      <Image
                        className="product-photo"
                        src={l.photos[0]}
                        alt={l.title}
                        fill
                        sizes="(max-width: 760px) 50vw, 25vw"
                      />
                    ) : (
                      <span>{l.emoji}</span>
                    )}
                    <span className="mode">{l.mode}</span>
                    <span className="heart">↗</span>
                  </div>
                  <div className="product-copy">
                    <span className="product-vendor">
                      {vendors.find((v) => v.id === l.vendorId)?.name}{" "}
                      {vendors.find((v) => v.id === l.vendorId)?.demo && (
                        <span>DEMO</span>
                      )}
                    </span>
                    <h3>{l.title}</h3>
                    <p>{l.description}</p>
                    <div className="product-bottom">
                      <strong>
                        {l.mode === "SELL" ? money(l.price) : "Quote required"}
                      </strong>
                      <span>
                        <Leaf size={12} />{" "}
                        {l.local ? "Made local" : "Around town"}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            {shown.length === 0 && (
              <div className="empty">
                No finds yet. Try another category or a shorter search.
              </div>
            )}
            {showFullCatalog && itemPageCount > 1 && (
              <nav className={styles.pagination} aria-label="Item pages">
                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={currentItemPage === 1}
                  onClick={() => changeItemPage(currentItemPage - 1)}
                >
                  Previous items
                </button>
                <span>
                  Page {currentItemPage} of {itemPageCount}
                </span>
                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={currentItemPage === itemPageCount}
                  onClick={() => changeItemPage(currentItemPage + 1)}
                >
                  Next items
                </button>
              </nav>
            )}
          </section>
        </section>
        <section className="runner-banner">
          <div className="runner-symbol">
            <Route size={34} />
          </div>
          <div>
            <div className="eyebrow">ALREADY HEADING THAT WAY?</div>
            <h2>Make your trip a little more neighborly.</h2>
            <p>
              Pick up something along the way. Help a neighbor. Keep it local.
            </p>
          </div>
          <Link href="/dashboard">
            Meet the runner community <ArrowUpRight size={18} />
          </Link>
        </section>
      </main>
      <footer inert={Boolean(selected)}>
        <span>{brand.name}</span>
        <span>Built for neighbors. Powered by possibility.</span>
        <span>Louisiana, MO · Demo marketplace</span>
      </footer>
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            ref={dialogRoot}
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close details"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <div className="modal-emoji">
              {selected.photos?.[0] ? (
                <Image
                  src={selected.photos[0]}
                  alt={selected.title}
                  width={400}
                  height={300}
                />
              ) : (
                selected.emoji
              )}
            </div>
            <div className="eyebrow">
              {vendors.find((v) => v.id === selected.vendorId)?.demo
                ? "DEMO"
                : "MARKETPLACE"}{" "}
              · {selected.mode} ·{" "}
              {selected.local ? "MADE LOCAL" : "AROUND TOWN"}
            </div>
            <h2>{selected.title}</h2>
            <p>{selected.description}</p>
            <p className="muted">
              {vendors.find((v) => v.id === selected.vendorId)?.name} ·{" "}
              {selected.inventory} available in demo data
            </p>
            <div className="quantity">
              <button
                aria-label="Decrease quantity"
                disabled={quantity === 1}
                onClick={() => setQuantity((q) => q - 1)}
              >
                <Minus size={16} />
              </button>
              <span>{quantity}</span>
              <button
                aria-label="Increase quantity"
                disabled={quantity === selected.inventory}
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus size={16} />
              </button>
              <strong>
                {selected.mode === "SELL"
                  ? money(selected.price * quantity)
                  : "Quote required"}
              </strong>
            </div>
            <Link href={`/listings/${selected.id}`}>
              View shareable listing →
            </Link>
            {!demo && selected.mode === "SELL" && (
              <label>
                Private delivery address
                <input
                  style={{ width: "100%", padding: 12, margin: "12px 0" }}
                  value={address}
                  readOnly={isolatedDemo}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={500}
                  autoComplete="street-address"
                  placeholder="Delivery address (shared only with assigned runner)"
                />
              </label>
            )}
            {!demo && (
              <button
                className="primary"
                onClick={addToCart}
                disabled={preparing}
              >
                {selected.mode === "SELL" ? "Add to cart" : "Request a quote"}
              </button>
            )}
            {(demo || selected.mode === "SELL") && (
              <button
                className="primary"
                onClick={prepare}
                disabled={preparing}
              >
                <ShoppingBag size={17} />{" "}
                {demo ? "Preview order" : "Prepare order"}{" "}
                <ChevronRight size={17} />
              </button>
            )}
            {notice && (
              <p role="status" className="notice">
                {notice}
              </p>
            )}
            <p className="muted">
              {demo
                ? "No payment or reservation is made in preview mode."
                : "Order preparation reserves inventory. Payment requires your explicit approval on the dashboard."}
            </p>
          </section>
        </div>
      )}
    </>
  );
}
