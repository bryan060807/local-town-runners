"use client";
import { useState } from "react";
export default function AdminModeration({
  id,
  type,
  disabled,
}: {
  id: string;
  type: "profile" | "listing" | "vendor";
  disabled: boolean;
}) {
  const [status, setStatus] = useState("");
  async function act() {
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: id,
          resourceType: type,
          disabled: !disabled,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      window.location.reload();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Denied");
    }
  }
  return (
    <>
      <button onClick={act}>{disabled ? "Enable" : "Suspend"}</button>
      <span role="status">{status}</span>
    </>
  );
}
