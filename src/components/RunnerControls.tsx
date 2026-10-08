"use client";
import { useState } from "react";
export default function RunnerControls({
  initialTransportation = "Walking",
  initialDetour = 3,
}: {
  initialTransportation?: string;
  initialDetour?: number;
}) {
  const [transportation, setTransportation] = useState(initialTransportation);
  const [detour, setDetour] = useState(initialDetour);
  const [status, setStatus] = useState("");
  async function update(minutes: number) {
    try {
      const r = await fetch("/api/runner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "availability",
          minutes,
          categories: ["Food", "Shops", "Gifts", "Farm", "Makers", "Services"],
          maxDetour: detour,
          transportation,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus(
        minutes
          ? "Available for one hour. Your public location is coarsened."
          : "Availability ended.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not update");
    }
  }
  return (
    <>
      <label>
        Transportation
        <select
          value={transportation}
          onChange={(e) => setTransportation(e.target.value)}
        >
          <option>Bicycle (demo)</option>
          <option>Walking</option>
          <option>Car</option>
        </select>
      </label>
      <label>
        Maximum detour (miles)
        <input
          type="number"
          min={0}
          max={50}
          value={detour}
          onChange={(e) => setDetour(Number(e.target.value))}
        />
      </label>
      <button onClick={() => update(60)}>Available for the next hour</button>{" "}
      <button onClick={() => update(0)}>End availability</button>
      <p role="status">{status}</p>
    </>
  );
}
