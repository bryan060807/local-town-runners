"use client";
import { useState } from "react";
export default function RunnerTrip({
  vendors,
}: {
  vendors: { id: string; name: string }[];
}) {
  const [vendor, setVendor] = useState(vendors[0]?.id || "");
  const [status, setStatus] = useState("");
  async function save() {
    try {
      const r = await fetch("/api/runner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "trip",
          vendorId: vendor,
          minutes: 60,
          note: "Already heading toward this vendor",
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus(
        "Trip intention shared for one hour. Exact location is private.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not share trip");
    }
  }
  return (
    <div>
      <label>
        I’m already going to…{" "}
        <select value={vendor} onChange={(e) => setVendor(e.target.value)}>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>{" "}
      <button disabled={!vendor} onClick={save}>
        Share trip for one hour
      </button>
      <p role="status">{status}</p>
    </div>
  );
}
