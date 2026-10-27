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
  const [url, setUrl] = useState("");
  async function open() {
    if (busy) return;
    setBusy(true);
    setError("");
    setUrl("");
    try {
      const r = await fetch(
        `/api/onboarding/${photo ? "photos" : "documents"}?id=${id}${presentation ? "&presentation=1" : ""}`,
      );
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setUrl(d.url);
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
            ? "Prepare private photograph link"
            : presentation
              ? "Prepare private presentation copy link"
              : "Prepare private agreement PDF link"}
      </button>
      {url && (
        <p>
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open private {photo ? "photograph" : "agreement PDF"} in a new tab
          </a>
          {" · This secure link expires. Request a new link if needed."}
        </p>
      )}
      <span role="status">{error}</span>
    </>
  );
}
