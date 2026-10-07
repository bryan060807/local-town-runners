"use client";
import UploadAsset from "./UploadAsset";
import { useState } from "react";
import { brand } from "@/lib/brand";
export default function VendorCreate({
  vendors,
}: {
  vendors: { id: string; name: string }[];
}) {
  const [vendorId, setVendorId] = useState(vendors[0]?.id || "");
  const [vendorName, setVendorName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Food");
  const [mode, setMode] = useState("SELL");
  const [price, setPrice] = useState(100);
  const [stock, setStock] = useState(1);
  const [local, setLocal] = useState(true);
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState("");
  async function request(data: unknown) {
    try {
      const r = await fetch("/api/vendor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus("Saved. Refresh the dashboard to see your changes.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not save");
    }
  }
  return (
    <div className="simple-card">
      <details>
        <summary>Create a demo vendor</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            request({
              action: "createVendor",
              name: vendorName,
              slug: vendorName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-|-$/g, ""),
              category,
              longitude: brand.center[0],
              latitude: brand.center[1],
            });
          }}
        >
          <p>
            New vendors are unverified demo entries until an administrator
            approves real data. Public location starts at the town’s general
            center.
          </p>
          <label>
            Vendor name
            <input
              required
              maxLength={150}
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
            />
          </label>
          <button className="primary">Create demo vendor</button>
        </form>
      </details>
      <details>
        <summary>Add a listing</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            request({
              action: "createListing",
              vendorId,
              title,
              description,
              category,
              mode,
              priceCents: price,
              inventory: stock,
              local,
            });
          }}
        >
          <label>
            Your vendor
            <select
              required
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              required
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <label>
            Description
            <input
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["Food", "Gifts", "Makers", "Farm", "Shops", "Services"].map(
                (c) => (
                  <option key={c}>{c}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Listing type
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {["SELL", "MAKE", "DO"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label>
            Price in cents
            <input
              type="number"
              min={0}
              max={10000000}
              required
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </label>
          <label>
            Available items / booking slots
            <input
              type="number"
              min={0}
              max={100000}
              required
              value={stock}
              onChange={(e) => setStock(Number(e.target.value))}
            />
          </label>
          <label>
            <input
              style={{ display: "inline", width: "auto" }}
              type="checkbox"
              checked={local}
              onChange={(e) => setLocal(e.target.checked)}
            />{" "}
            Made local
          </label>
          <button disabled={!vendorId} className="primary">
            Create listing
          </button>
        </form>
      </details>
      <details>
        <summary>Private pickup address</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            request({
              action: "pickup",
              vendorId,
              address,
              longitude: null,
              latitude: null,
            });
          }}
        >
          <label>
            Your vendor
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pickup address
            <input
              required
              minLength={5}
              maxLength={500}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>
          <p>
            Only your vendor account and the active assigned runner can read
            this address. It never appears on the public map.
          </p>
          <button className="primary" disabled={!vendorId}>
            Save private pickup address
          </button>
        </form>
      </details>
      {vendorId && (
        <details>
          <summary>Vendor images</summary>
          <UploadAsset
            label="Vendor logo"
            data={{ target: "logo", vendorId }}
          />
          <UploadAsset
            label="Cover image"
            data={{ target: "cover", vendorId }}
          />
        </details>
      )}
      <p role="status">{status}</p>
    </div>
  );
}
