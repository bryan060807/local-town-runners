"use client";
import { useState } from "react";
export default function UploadAsset({
  data,
  label,
}: {
  data:
    | { target: "listing"; vendorId: string; listingId: string }
    | { target: "logo" | "cover"; vendorId: string }
    | { target: "runner" };
  label: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function upload() {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("data", JSON.stringify(data));
      form.set("file", file);
      const r = await fetch("/api/assets", { method: "POST", body: form });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus(
        "Image saved. Refresh to see it. Location metadata was removed.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label>
        {label}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      <p>
        PNG, JPEG or WebP · under 5 MB / 16 megapixels. Public images are
        resized and location metadata removed.
      </p>
      <button type="button" disabled={!file || busy} onClick={upload}>
        {busy ? "Uploading…" : "Upload image"}
      </button>
      <p role="status">{status}</p>
    </div>
  );
}
