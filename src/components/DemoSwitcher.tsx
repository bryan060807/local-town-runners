"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { demoNames, demoRoles, DemoRole } from "@/lib/demo-catalog";
import styles from "./DemoJourney.module.css";

const roleLabels: Record<DemoRole, string> = {
  customer: "Customer",
  vendor: "Vendor",
  runner: "Runner",
};
const responsibilities: Record<DemoRole, string> = {
  customer: "Find something local and review your order.",
  vendor: "Accept the order and get it ready for pickup.",
  runner: "Coordinate pickup and bring it to the customer.",
};

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
    <section
      className={`demo-bar ${styles.bar} ${!state.active ? styles.entryBar : ""}`}
      aria-label="Demo Mode"
    >
      <div className={styles.inner}>
        <div className={styles.toolbar}>
          <span className="demo-tag">
            {state.active ? "DEMO ONLY" : "DEMO AVAILABLE"}
          </span>
          {state.active ? (
            <>
              <div className={styles.identity}>
                <span>
                  Viewing {state.role ? roleLabels[state.role] : "demo profile"}
                </span>
                <strong>{state.role && demoNames[state.role]}</strong>
              </div>
              <label className={styles.profileControl}>
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
              <nav className={styles.navigation} aria-label="Demo navigation">
                <Link href="/">Explore</Link>
                {state.role === "customer" && <Link href="/cart">Cart</Link>}
                <Link href="/dashboard">Dashboard</Link>
                <button disabled={busy} onClick={() => change()}>
                  Exit demo
                </button>
              </nav>
            </>
          ) : (
            <>
              <div className={styles.intro}>
                <span>
                  Try fictional profiles in a separate private demo workspace.
                </span>
              </div>
              <button
                className={styles.enterButton}
                disabled={busy}
                onClick={() => change("customer")}
              >
                {busy ? "Preparing your demo…" : "Enter Demo Mode"}
              </button>
            </>
          )}
        </div>
        {state.active && (
          <details className={styles.help}>
            <summary>How the demo works</summary>
            <ol className={styles.roles} aria-label="Demo roles">
              {demoRoles.map((role) => (
                <li
                  key={role}
                  aria-current={
                    state.active && state.role === role ? "true" : undefined
                  }
                >
                  <strong>{roleLabels[role]}</strong>
                  <span>{responsibilities[role]}</span>
                </li>
              ))}
            </ol>
            <p>
              These are fictional profiles in your private demo workspace. Use
              Switch profile to play the next role in this browser. Choose
              simulated payment to complete the walkthrough without a PayPal
              charge.
            </p>
          </details>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
