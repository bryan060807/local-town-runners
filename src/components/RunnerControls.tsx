"use client";
import { useState } from "react";
export default function RunnerControls() {
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
          maxDetour: 3,
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
      <button onClick={() => update(60)}>Available for the next hour</button>{" "}
      <button onClick={() => update(0)}>End availability</button>
      <p role="status">{status}</p>
    </>
  );
}
