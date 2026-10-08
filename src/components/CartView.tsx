"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { money } from "@/lib/catalog";
import Link from "next/link";
type Row = {
  listing_id: string;
  quantity: number;
  title: string;
  price: number;
  inventory: number;
  vendorId: string;
  vendorName: string;
};
export default function CartView({
  items,
  initialAddress,
  demo,
}: {
  items: Row[];
  initialAddress: string;
  demo: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [address, setAddress] = useState(initialAddress);
  const keys = useRef<Record<string, string>>({});
  const groups = [...new Set(items.map((i) => i.vendorId))];
  async function remove(id: string) {
    setBusy(true);
    try {
      const r = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      location.reload();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Cart unavailable");
      setBusy(false);
    }
  }
  async function prepare(vendorId: string) {
    setBusy(true);
    setStatus("");
    const signature = JSON.stringify([
      vendorId,
      address,
      items.filter((i) => i.vendorId === vendorId),
    ]);
    keys.current[signature] ||= crypto.randomUUID();
    try {
      const r = await fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId,
          requestId: keys.current[signature],
          deliveryAddress: address,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      router.push("/dashboard?prepared=" + j.order.id);
      router.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Preparation unavailable");
      setBusy(false);
    }
  }
  return (
    <>
      <p>
        Current prices come from the database. Preparing an order reserves
        stock; PayPal approval is a separate step. Checkout is grouped by
        vendor.
      </p>
      {!items.length && (
        <div className="simple-card">
          <h2>Your cart is ready for a little discovery.</h2>
          <Link href="/">Find something local →</Link>
        </div>
      )}
      <label>
        Delivery address
        <input
          value={address}
          readOnly={demo}
          onChange={(e) => setAddress(e.target.value)}
          maxLength={500}
        />
      </label>
      {demo && (
        <p className="muted">
          Fictional test address only. No real delivery or goods.
        </p>
      )}
      {groups.map((id) => {
        const rows = items.filter((i) => i.vendorId === id);
        return (
          <section className="simple-card" key={id}>
            <h2>{rows[0].vendorName}</h2>
            {rows.map((i) => (
              <div className="cart-line" key={i.listing_id}>
                <div>
                  <Link href={"/listings/" + i.listing_id}>{i.title}</Link>
                  <p>
                    {i.quantity} × {money(i.price)} · {i.inventory} currently
                    available
                  </p>
                </div>
                <button disabled={busy} onClick={() => remove(i.listing_id)}>
                  Remove
                </button>
              </div>
            ))}
            <strong>
              Total{" "}
              {money(rows.reduce((sum, i) => sum + i.price * i.quantity, 0))}
            </strong>
            <button
              className="primary"
              disabled={
                busy ||
                address.length < 8 ||
                rows.some((i) => i.quantity > i.inventory)
              }
              onClick={() => prepare(id)}
            >
              Prepare this vendor order
            </button>
          </section>
        );
      })}
      <p role="status">{status}</p>
    </>
  );
}
