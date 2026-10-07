"use client";
import UploadAsset from "./UploadAsset";
import { useState } from "react";
export default function VendorEditor({
  id,
  vendorId,
  title,
  inventory,
  price,
  active,
}: {
  id: string;
  vendorId: string;
  title: string;
  inventory: number;
  price: number;
  active: boolean;
}) {
  const [stock, setStock] = useState(inventory);
  const [cents, setCents] = useState(price);
  const [enabled, setEnabled] = useState(active);
  const [status, setStatus] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await fetch("/api/vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          listingId: id,
          inventory: stock,
          priceCents: cents,
          active: enabled,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus("Listing updated.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Update failed");
    }
  }
  return (
    <form onSubmit={save} className="simple-card">
      <h3>{title}</h3>
      <label>
        Available inventory
        <input
          type="number"
          min={0}
          max={100000}
          value={stock}
          onChange={(e) => setStock(Number(e.target.value))}
        />
      </label>
      <label>
        Price in cents
        <input
          type="number"
          min={0}
          max={10000000}
          value={cents}
          onChange={(e) => setCents(Number(e.target.value))}
        />
      </label>
      <label>
        <input
          style={{ display: "inline", width: "auto" }}
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />{" "}
        Active
      </label>
      <button className="primary">Save listing</button>
      <UploadAsset
        label="Listing photo"
        data={{ target: "listing", vendorId, listingId: id }}
      />
      <p role="status">{status}</p>
    </form>
  );
}
