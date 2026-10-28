"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Coffee,
  Gift,
  Leaf,
  MapPin,
  Route,
  Sparkles,
  Store,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { Listing, Vendor, money } from "@/lib/catalog";
import { PublicRunner } from "@/lib/map-types";
import {
  neighborhoodConnections,
  type ConnectionIntent,
} from "@/lib/neighborhood-connections";
import styles from "./NeighborhoodStudio.module.css";

const intents = [
  { id: "gift", label: "A gift under $30", Icon: Gift },
  { id: "food", label: "Something to eat", Icon: Coffee },
  { id: "local", label: "Made nearby", Icon: Leaf },
] as const;

function FindIllustration({
  category,
  title,
}: {
  category: string;
  title: string;
}) {
  return (
    <div className={styles.illustration}>
      <svg
        viewBox="0 0 220 180"
        fill="none"
        role="img"
        aria-label={`${category} illustration, not a product photograph`}
      >
        <ellipse
          cx="112"
          cy="153"
          rx="75"
          ry="12"
          fill="#bd8867"
          opacity=".14"
        />
        <circle cx="111" cy="87" r="69" fill="#ead6b8" />
        <path
          d="M30 49h13m-6-6v13M176 119h12m-6-6v12"
          stroke="#ac8158"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {category === "Food" ? (
          <>
            <path
              d="M47 115c0-30 27-57 65-57s65 27 65 57v9H47v-9Z"
              fill="#b97947"
            />
            <path d="M63 113c0-22 19-43 49-43s49 21 49 43" fill="#d9a66f" />
            <path
              d="m90 76-9 27m34-29-9 28m34-20-8 24"
              stroke="#f7ddae"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path d="M36 125h151l-12 12H49l-13-12Z" fill="#fdf8ec" />
            <path
              d="M81 44c-7-10 9-12 2-23m29 24c-7-10 9-12 2-23m29 25c-7-10 9-12 2-23"
              stroke="#8c9b76"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        ) : category === "Farm" || category === "Makers" ? (
          <>
            <path d="M75 91h77l-10 49H85L75 91Z" fill="#b87655" />
            <path d="M70 88h87v12H70V88Z" fill="#cc9774" />
            <path
              d="M113 87V40m0 27C84 66 77 45 77 45s31-6 36 22Zm0-10c28-2 36-24 36-24s-30-4-36 24Z"
              stroke="#3e6549"
              strokeWidth="3"
              fill="#66815a"
              strokeLinejoin="round"
            />
            <path
              d="M101 111h25"
              stroke="#e5c6a6"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        ) : /mug|cup|ceramic/i.test(title) ? (
          <>
            <path
              d="M69 64h80v56c0 18-15 29-40 29s-40-11-40-29V64Z"
              fill="#a56c4e"
            />
            <path
              d="M149 78h11c29 0 28 44-10 44"
              stroke="#a56c4e"
              strokeWidth="13"
            />
            <ellipse cx="109" cy="65" rx="40" ry="9" fill="#e7c7a3" />
            <ellipse cx="109" cy="65" rx="31" ry="5" fill="#694b39" />
            <path
              d="M81 91c8 5 17 8 29 8s21-3 27-8"
              stroke="#d5ac87"
              strokeWidth="2"
            />
            <path
              d="M95 44c-8-10 8-15 0-25m26 25c-8-10 8-15 0-25"
              stroke="#8b9b79"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            <path d="M64 80h96v61H64V80Z" fill="#b9805a" />
            <path d="M58 69h108v20H58V69Z" fill="#d8ad78" />
            <path d="M104 69h16v72h-16V69Z" fill="#f3e3bd" />
            <path
              d="M111 69c-33 0-42-11-35-22 8-12 28-1 35 22Zm0 0c33 0 42-11 35-22-8-12-28-1-35 22Z"
              fill="#ead2a5"
              stroke="#bd8c5c"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </>
        )}
        <path d="m171 42 4 8 8 4-8 4-4 8-4-8-8-4 8-4 4-8Z" fill="#c59b5e" />
      </svg>
      <span>Illustration</span>
    </div>
  );
}

export default function NeighborhoodStudio({
  listings,
  vendors,
  runners,
  snapshotAt,
  offline,
  privateDemo,
  onReview,
  onAsk,
  canEnterDemo = false,
  onEnterDemo,
}: {
  listings: Listing[];
  vendors: Vendor[];
  runners: PublicRunner[];
  snapshotAt: number;
  offline: boolean;
  privateDemo: boolean;
  onReview: (listingId: string, runnerId?: string) => void;
  onAsk: (listingId: string) => void;
  canEnterDemo?: boolean;
  onEnterDemo?: () => Promise<void>;
}) {
  const [intent, setIntent] = useState<ConnectionIntent>("gift");
  const [selectedId, setSelectedId] = useState("");
  const [now, setNow] = useState(snapshotAt);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [demoError, setDemoError] = useState("");

  async function buildDemo() {
    if (creatingDemo || !onEnterDemo) return;
    setCreatingDemo(true);
    setDemoError("");
    try {
      await onEnterDemo();
    } catch (error) {
      setDemoError(
        error instanceof Error
          ? error.message
          : "Demo unavailable. Please try again.",
      );
      setCreatingDemo(false);
    }
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let active = true;
    function tick() {
      if (!active) return;
      const current = Date.now();
      setNow(current);
      const deadlines = runners
        .flatMap((runner) => [runner.availableUntil, runner.tripExpiresAt])
        .filter(
          (time): time is number => Number.isFinite(time) && time! > current,
        );
      const delay = deadlines.length
        ? Math.min(30000, Math.max(50, Math.min(...deadlines) - current + 10))
        : 30000;
      timer = setTimeout(tick, delay);
    }
    timer = setTimeout(tick, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [runners, snapshotAt]);

  const connections = neighborhoodConnections({
    listings,
    vendors,
    runners,
    intent,
    now,
  });
  const selected =
    connections.find((connection) => connection.listing.id === selectedId) ||
    connections[0];
  const firstChoices = connections.slice(0, 3);
  const choices =
    selected && !firstChoices.includes(selected)
      ? [selected, ...firstChoices].slice(0, 3)
      : firstChoices;
  const remaining = selected?.tripUntil
    ? Math.max(1, Math.ceil((selected.tripUntil - now) / 60000))
    : undefined;

  return (
    <section className={styles.shell} aria-label="Neighborhood Connection">
      <div className={styles.story}>
        <div className={styles.eyebrow}>
          <span className={styles.signal} /> LOCAL GOODS. SHARED TRIPS.
        </div>
        <h1 className={styles.title}>
          Good things.
          <br />
          <span>Close to home.</span>
        </h1>
        <p className={styles.promise}>
          {selected?.runner
            ? "A local find. A trip already planned."
            : selected
              ? "A local find. A pickup to plan."
              : "Your next local connection starts here."}
        </p>
        <p className={styles.description}>
          Your next favorite could be down the road. See how a shop and a
          neighbor’s shared trip can connect it to you.
        </p>
        <div
          className={styles.intents}
          role="group"
          aria-label="Choose a connection"
        >
          {intents.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={intent === id}
              onClick={() => {
                setIntent(id);
                setSelectedId("");
              }}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <Link className={styles.exploreLink} href="#explore">
          Find something nearby <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <div className={styles.town}>
          <MapPin size={14} aria-hidden="true" />
          <span>
            {brand.town}
            <small>Our first neighborhood. Your town could be next.</small>
          </span>
        </div>
      </div>

      <div className={styles.canvas}>
        <div className={styles.canvasTop}>
          <div>
            <span className={styles.overline}>SEE THE POSSIBILITY</span>
            <h2>A neighborhood connection</h2>
          </div>
          <span className={styles.previewMode}>
            {offline
              ? "Illustrative catalog"
              : privateDemo
                ? "Your private demo"
                : "Catalog preview"}
          </span>
        </div>
        {selected ? (
          <>
            <article
              className={styles.find}
              aria-label="Selected find"
              data-listing-id={selected.listing.id}
              key={selected.listing.id}
            >
              <div className={styles.findArt}>
                {selected.listing.photos?.[0] ? (
                  <Image
                    src={selected.listing.photos[0]}
                    alt={selected.listing.title}
                    fill
                    sizes="(max-width: 760px) 35vw, 230px"
                    className={styles.productPhoto}
                  />
                ) : (
                  <FindIllustration
                    category={selected.listing.category}
                    title={selected.listing.title}
                  />
                )}
              </div>
              <div className={styles.findCopy}>
                <span className={styles.step}>01 / FIND SOMETHING GOOD</span>
                <h2>{selected.listing.title}</h2>
                <div className={styles.priceLine}>
                  <span className={styles.price} aria-label="Item price">
                    {money(selected.listing.price)}
                  </span>
                  {selected.listing.local && (
                    <span className={styles.local}>
                      <Leaf size={11} aria-hidden="true" /> Made locally
                    </span>
                  )}
                </div>
                <p className={styles.stock}>
                  <Check size={12} aria-hidden="true" /> In the current
                  available catalog
                </p>
              </div>
            </article>

            <div className={styles.handoff} aria-hidden="true">
              <ArrowDown size={18} />
              <span>A shop. A neighbor. One possible pickup.</span>
            </div>

            <div className={styles.nodes}>
              <div className={styles.shop}>
                <div className={styles.nodeTop}>
                  <span className={styles.nodeIcon}>
                    <Store size={17} aria-hidden="true" />
                  </span>
                  <span className={styles.step}>02 / THE LOCAL SHOP</span>
                </div>
                <h3>{selected.vendor.name}</h3>
                <p>
                  {selected.vendor.demo
                    ? "Fictional vendor"
                    : "Local storefront"}
                </p>
              </div>
              {selected.runner ? (
                <div
                  className={styles.runner}
                  role="group"
                  aria-label="Declared trip candidate"
                >
                  <div className={styles.nodeTop}>
                    <span className={styles.avatar} aria-hidden="true">
                      {selected.runner.name.trim().slice(0, 1)}
                    </span>
                    <span className={styles.step}>03 / A SHARED TRIP</span>
                  </div>
                  <h3>{selected.runner.name}</h3>
                  <p className={styles.trip}>
                    <Route size={13} aria-hidden="true" /> Declared trip to this
                    shop
                  </p>
                  <p className={styles.expiry}>
                    Trip window ends in {remaining} min
                  </p>
                  {selected.runner.demo && (
                    <span className={styles.runnerDemo}>Demo runner</span>
                  )}
                </div>
              ) : (
                <div
                  className={styles.noTrip}
                  role="group"
                  aria-label="Pickup options"
                >
                  <div className={styles.nodeTop}>
                    <span className={styles.nodeIcon}>
                      <Route size={17} aria-hidden="true" />
                    </span>
                    <span className={styles.step}>03 / PLAN THE PICKUP</span>
                  </div>
                  <h3>Room for a connection.</h3>
                  <p>No shared trip to this shop in this preview.</p>
                  <span>Check pickup options before ordering.</span>
                  {!privateDemo && !offline && canEnterDemo && onEnterDemo && (
                    <button
                      className={styles.buildDemo}
                      type="button"
                      disabled={creatingDemo}
                      onClick={buildDemo}
                    >
                      {creatingDemo
                        ? "Building your demo…"
                        : "Build a private demo"}
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {demoError && (
              <p className={styles.demoError} role="alert">
                {demoError}
              </p>
            )}

            <div className={styles.confirmation} role="note">
              <span className={styles.confirmationDot} />
              {selected.runner
                ? "Declared trip · Runner confirmation needed."
                : "Pickup needs confirmation from a shop and runner."}
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.review}
                onClick={() =>
                  onReview(selected.listing.id, selected.runner?.id)
                }
              >
                Review this find <ArrowUpRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={styles.ask}
                onClick={() => onAsk(selected.listing.id)}
              >
                <Sparkles size={15} aria-hidden="true" /> Ask Sidekick
              </button>
            </div>

            {choices.length > 1 && (
              <div
                className={styles.alternatives}
                role="group"
                aria-label="Available finds"
              >
                <span>Another possibility</span>
                <div className={styles.choiceList}>
                  {choices.map(({ listing }) => (
                    <button
                      key={listing.id}
                      type="button"
                      aria-label={`Preview ${listing.title}`}
                      aria-pressed={selected.listing.id === listing.id}
                      onClick={() => setSelectedId(listing.id)}
                    >
                      <span>{listing.title}</span>
                      <strong>{money(listing.price)}</strong>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.empty} role="status">
            <Store size={36} aria-hidden="true" />
            <h3>A new connection starts with a find.</h3>
            <p>
              No available items fit this choice right now. Try another idea or
              browse the local vendors below.
            </p>
            <Link href="#vendor-directory-heading">
              Explore local vendors{" "}
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}
        <p className={styles.footnote}>
          A preview from this catalog. Reviewing a find does not reserve stock,
          arrange a pickup or make a payment.
        </p>
      </div>
    </section>
  );
}
