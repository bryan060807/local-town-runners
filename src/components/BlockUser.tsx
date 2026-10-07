"use client";
import { useState } from "react";
export default function BlockUser({ id }: { id: string }) {
  const [status, setStatus] = useState("");
  async function block() {
    try {
      const r = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus(
        "Blocked. Future assignments between these accounts are prevented.",
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not block account");
    }
  }
  return (
    <>
      <button onClick={block}>Block account (sign-in required)</button>
      <p role="status">{status}</p>
    </>
  );
}
