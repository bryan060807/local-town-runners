"use client";
import { useState } from "react";
export default function PrivateDocument({
  id,
  photo = false,
  presentation = false,
}: {
  id: string;
  photo?: boolean;
  presentation?: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      const r = await fetch(
        `/api/onboarding/${photo ? "photos" : "documents"}?id=${id}${presentation ? "&presentation=1" : ""}`,
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      window.open(d.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button type="button" disabled={busy} onClick={open}>
        {busy
          ? "Preparing secure link…"
          : photo
            ? "View private photograph"
            : presentation
              ? "Download private presentation copy"
              : "Download private agreement PDF"}
      </button>
      <span role="status">{error}</span>
    </>
  );
}
