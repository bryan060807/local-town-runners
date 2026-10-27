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
  const [busy, setBusy] = useState(false);
  async function update(minutes: number) {
    if (busy) return;
    if (!Number.isFinite(detour) || detour < 0 || detour > 50) {
      setStatus("Choose a maximum detour between 0 and 50 miles.");
      return;
    }
    setBusy(true);
    setStatus("");
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
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <label>
        Transportation
        <select
          value={transportation}
          disabled={busy}
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
          step="any"
          disabled={busy}
          value={detour}
          onChange={(e) => setDetour(Number(e.target.value))}
        />
      </label>
      <button disabled={busy} onClick={() => update(60)}>
        Available for the next hour
      </button>{" "}
      <button disabled={busy} onClick={() => update(0)}>
        End availability
      </button>
      <p role="status">{status}</p>
    </>
  );
}
