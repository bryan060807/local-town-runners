"use client";
import { useState } from "react";
export default function AdminRole({ id }: { id: string }) {
  const [role, setRole] = useState("customer");
  const [status, setStatus] = useState("");
  async function assign() {
    try {
      const r = await fetch("/api/admin/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id, role }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus("Role assigned and audited.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Assignment failed");
    }
  }
  return (
    <>
      <select
        aria-label="Role to grant"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        {["customer", "vendor", "runner", "admin"].map((r) => (
          <option key={r}>{r}</option>
        ))}
      </select>{" "}
      <button onClick={assign}>Grant role</button>
      <span role="status">{status}</span>
    </>
  );
}
