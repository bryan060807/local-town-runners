"use client";
import Image from "next/image";
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
}: {
  listings: Listing[];
  vendors: Vendor[];
  runners: PublicRunner[];
  demo: boolean;
}) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [category, setCategory] = useState("All");
  const [localOnly, setLocalOnly] = useState(false);
  const [query, setQuery] = useState("");
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
  const [address, setAddress] = useState("");
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
        router.push("/dashboard");
        return;
      }
      setNotice(`${d.formatted} · ${d.message}`);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not prepare order");
    } finally {
      setPreparing(false);
    }
  }
  const shown = listings.filter(
    (l) =>
      l.active &&
      (!localOnly || l.local) &&
      l.inventory > 0 &&
      (category === "All" || l.category === category) &&
      `${l.title} ${l.description}`.toLowerCase().includes(query.toLowerCase()),
  );
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
          <Link href="#local" onClick={() => setLocalOnly(true)}>
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
                        {l.emoji} {l.title} <strong>{money(l.price)}</strong>
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
          <div className="section-top">
            <div>
              <div className="eyebrow">FROM AROUND THE CORNER</div>
              <h2>Small town. Great finds.</h2>
            </div>
            <button
              aria-pressed={localOnly}
              onClick={() => setLocalOnly((v) => !v)}
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
                  onClick={() => setCategory(c)}
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
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find your next good thing"
              />
            </label>
          </div>
          <div className="cards">
            {shown.map((l, i) => (
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
                    <span>DEMO</span>
                  </span>
                  <h3>{l.title}</h3>
                  <p>{l.description}</p>
                  <div className="product-bottom">
                    <strong>{money(l.price)}</strong>
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
              <strong>{money(selected.price * quantity)}</strong>
            </div>
            <Link href={`/listings/${selected.id}`}>
              View shareable listing →
            </Link>
            {!demo && (
              <label>
                Private delivery address
                <input
                  style={{ width: "100%", padding: 12, margin: "12px 0" }}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={500}
                  autoComplete="street-address"
                  placeholder="Delivery address (shared only with assigned runner)"
                />
              </label>
            )}
            <button className="primary" onClick={prepare} disabled={preparing}>
              <ShoppingBag size={17} />{" "}
              {demo ? "Preview order" : "Prepare order"}{" "}
              <ChevronRight size={17} />
            </button>
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
