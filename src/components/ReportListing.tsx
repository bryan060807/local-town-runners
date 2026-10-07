"use client";
import { useState } from "react";
export default function ReportListing({ id }: { id: string }) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState("");
  async function report(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: id, reason }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus("Report submitted for admin review.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Report failed");
    }
  }
  return (
    <details>
      <summary>Report this listing</summary>
      <form onSubmit={report}>
        <label>
          Reason
          <input
            required
            minLength={5}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button className="primary">Submit report (sign-in required)</button>
        <p role="status">{status}</p>
      </form>
    </details>
  );
}
