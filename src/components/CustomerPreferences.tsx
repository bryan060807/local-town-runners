"use client";
import { useState } from "react";
export default function CustomerPreferences({
  address,
  notes,
  demo,
}: {
  address: string;
  notes: string;
  demo: boolean;
}) {
  const [a, setA] = useState(address),
    [n, setN] = useState(notes),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const r = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: a, notes: n }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setStatus("Delivery preferences saved.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="simple-card">
      <h2>Delivery preferences</h2>
      <label>
        {demo ? "Fictional saved test address" : "Saved delivery address"}
        <input
          value={a}
          onChange={(e) => setA(e.target.value)}
          readOnly={demo}
          maxLength={500}
        />
      </label>
      <label>
        Delivery preferences
        <textarea
          value={n}
          onChange={(e) => setN(e.target.value)}
          maxLength={500}
        />
      </label>
      <button disabled={busy || a.length < 8} onClick={save}>
        Save delivery preferences
      </button>
      <p role="status">{status}</p>
    </section>
  );
}
