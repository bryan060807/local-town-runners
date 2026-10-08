"use client";
import { useState } from "react";
export default function InquiryCard({
  id,
  message,
  response,
  vendor,
}: {
  id: string;
  message: string;
  response: string;
  vendor: boolean;
}) {
  const [value, setValue] = useState(response),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      const r = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, response: value }),
      });
      const j = await r.json();
      if (!r.ok) throw Error(j.error);
      location.reload();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Response unavailable");
      setBusy(false);
    }
  }
  return (
    <div className="simple-card">
      <p>{message}</p>
      {vendor ? (
        <>
          <label>
            Reply with scope and availability
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={2000}
            />
          </label>
          <button disabled={busy || !value.trim()} onClick={send}>
            Send response
          </button>
        </>
      ) : (
        <p>
          {response ||
            "Waiting for the vendor. No reservation or payment has been made."}
        </p>
      )}
      <p role="status">{status}</p>
    </div>
  );
}
