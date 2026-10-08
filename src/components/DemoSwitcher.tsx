"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { demoNames, demoRoles, DemoRole } from "@/lib/demo-catalog";
export default function DemoSwitcher() {
  const [state, setState] = useState<{
    enabled: boolean;
    active?: boolean;
    role?: DemoRole;
  }>({ enabled: false });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/demo")
      .then((r) => r.json())
      .then(setState)
      .catch(() => {});
  }, []);
  async function change(role?: DemoRole) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/demo", {
        method: role ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        ...(role ? { body: JSON.stringify({ role }) } : {}),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      location.assign(role === "customer" ? "/" : role ? "/dashboard" : "/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo unavailable");
      setBusy(false);
    }
  }
  if (!state.enabled) return null;
  return (
    <section className="demo-bar" aria-label="Demo Mode">
      <span className="demo-tag">DEMO ONLY</span>
      {state.active ? (
        <>
          <strong>{state.role && demoNames[state.role]}</strong>
          <label>
            Switch profile{" "}
            <select
              aria-label="Switch demo profile"
              value={state.role}
              disabled={busy}
              onChange={(e) => change(e.target.value as DemoRole)}
            >
              {demoRoles.map((r) => (
                <option key={r} value={r}>
                  {r} — {demoNames[r]}
                </option>
              ))}
            </select>
          </label>
          <Link href="/">Explore</Link>
          {state.role === "customer" && <Link href="/cart">Cart</Link>}
          <Link href="/dashboard">Dashboard</Link>
          <button disabled={busy} onClick={() => change()}>
            Exit demo
          </button>
        </>
      ) : (
        <>
          <span>
            Explore three fictional profiles in your own private demo.
          </span>
          <button disabled={busy} onClick={() => change("customer")}>
            {busy ? "Preparing your demo…" : "Enter Demo Mode"}
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
