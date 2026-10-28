"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { money, type Listing } from "@/lib/catalog";
import styles from "./ListingActions.module.css";

export type ListingAccess = "customer" | "guest" | "other" | "offline";

export default function ListingActions({
  listing,
  access,
  privateDemo,
  initialQuantity = 1,
  inCart = false,
}: {
  listing: Pick<Listing, "id" | "title" | "mode" | "price" | "inventory">;
  access: ListingAccess;
  privateDemo: boolean;
  initialQuantity?: number;
  inCart?: boolean;
}) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [quantity, setQuantity] = useState(String(initialQuantity));
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const inFlight = useRef(false);
  const sell = listing.mode === "SELL";
  const limit = Math.min(20, listing.inventory);
  const units = Number(quantity);
  const validQuantity =
    Number.isSafeInteger(units) && units >= 1 && units <= limit;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !hydrated ||
      access !== "customer" ||
      inFlight.current ||
      (sell ? !validQuantity : sent || message.trim().length < 5)
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setStatus("");
    setFailed(false);
    try {
      const response = await fetch(sell ? "/api/cart" : "/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sell
            ? { listingId: listing.id, quantity: units }
            : { listingId: listing.id, message: message.trim() },
        ),
      });
      if (!response.ok) {
        setFailed(true);
        setStatus(
          response.status === 401
            ? "Your session has ended. Sign in again or return to the marketplace to enter Demo Mode."
            : response.status === 403
              ? "A customer profile is required. Check your account or switch to the Customer demo profile."
              : response.status === 409
                ? "This item’s availability has changed. Refresh the listing and review your quantity before trying again."
                : response.status === 429
                  ? "Please wait a moment before trying again. Your selection is still here."
                  : "We couldn’t save that just now. Your selection is still here; please try again.",
        );
        return;
      }
      if (sell) {
        setStatus("Saved to your cart. Review your items and address next.");
        router.push("/cart");
        router.refresh();
      } else {
        setSent(true);
        setStatus(
          "Quote request sent to the vendor. No order or payment was created.",
        );
      }
    } catch {
      setFailed(true);
      setStatus(
        "We couldn’t save that just now. Your selection is still here; please try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className={`simple-card ${styles.panel}`}
      aria-label="Choose this item"
    >
      <h2>
        {sell ? "Add this find to your cart" : "Ask the vendor for a quote"}
      </h2>
      {access === "customer" ? (
        <>
          <form onSubmit={submit} aria-busy={busy}>
            <fieldset
              disabled={!hydrated || busy || sent}
              className={styles.fields}
            >
              {sell ? (
                <div className={styles.selection}>
                  <label>
                    Quantity
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={limit}
                      step={1}
                      required
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                    />
                  </label>
                  <div className={styles.total}>
                    <span>Item total</span>
                    <strong aria-label="Selected item total">
                      {validQuantity
                        ? money(listing.price * units)
                        : "Choose a quantity"}
                    </strong>
                  </div>
                </div>
              ) : (
                <label>
                  Quote request
                  <textarea
                    required
                    minLength={5}
                    maxLength={1000}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder={`Tell the vendor what you need for ${listing.title}.`}
                  />
                </label>
              )}
              {sell && Number.isSafeInteger(units) && units > limit && (
                <p role="note">
                  Only {limit} available now. Choose a smaller quantity before
                  continuing.
                </p>
              )}
              <button
                type="submit"
                className="primary"
                disabled={sell ? !validQuantity : message.trim().length < 5}
              >
                {busy
                  ? "Saving…"
                  : sent
                    ? "Quote request sent"
                    : sell
                      ? inCart
                        ? "Update cart"
                        : "Add to cart"
                      : "Request a quote"}
              </button>
            </fieldset>
          </form>
          <p className={styles.note}>
            {sell
              ? "Review your cart and delivery address before preparing an order. Adding to your cart does not reserve stock or make a payment."
              : "The vendor can reply in your dashboard. A quote request does not reserve stock or make a payment."}
          </p>
          {privateDemo && (
            <p className={styles.note}>
              Private demo · fictional products and delivery address.
            </p>
          )}
          <p role={failed ? "alert" : "status"}>{status}</p>
          <Link className={styles.next} href={sell ? "/cart" : "/dashboard"}>
            {sell ? "View cart" : "View quote inquiries"} →
          </Link>
        </>
      ) : access === "offline" ? (
        <>
          <p>
            This illustrative catalog supports browsing. A connected customer
            session is needed for carts and quote requests.
          </p>
          <Link className={styles.next} href="/">
            Browse the marketplace →
          </Link>
        </>
      ) : access === "guest" ? (
        <>
          <p>
            Sign in as a customer to{" "}
            {sell ? "choose a quantity and continue" : "send a quote request"}.
            To try a fictional order, enter Demo Mode from the marketplace and
            choose an item in your private catalog.
          </p>
          <Link className="primary" href="/login">
            Sign in to shop
          </Link>
          <Link className={styles.next} href="/">
            Back to the marketplace →
          </Link>
        </>
      ) : (
        <>
          <p>
            {privateDemo
              ? "Switch to the Customer demo profile above to add items or request a quote."
              : "An active customer profile is required to add items or request a quote."}
          </p>
          <Link className={styles.next} href="/account">
            View account →
          </Link>
        </>
      )}
    </section>
  );
}
