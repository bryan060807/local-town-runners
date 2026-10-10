"use client";
import { useState } from "react";
export default function PayPalDiagnostics() {
  const [report, setReport] = useState(""),
    [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/paypal-diagnostics", {
        method: "POST",
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      setReport(JSON.stringify(j, null, 2));
    } catch (e) {
      setReport(e instanceof Error ? e.message : "Check unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button disabled={busy} onClick={check}>
        {busy
          ? "Checking Sandbox authentication…"
          : "Check PayPal Sandbox authentication"}
      </button>
      <pre className="application-details" role="status">
        {report}
      </pre>
    </>
  );
}
