"use client";
import { useState } from "react";
import Link from "next/link";
export default function Page() {
  const [password, setPassword] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="simple-page">
      <Link href="/login">← Sign in</Link>
      <h1>Choose a new password</h1>
      <p>
        Open your recovery email link first. The link establishes a secure
        recovery session.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "password", password }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            setStatus(
              "Password updated. Sign out, then sign in with your new password.",
            );
          } catch (e) {
            setStatus(e instanceof Error ? e.message : "Update failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          New password
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button disabled={busy}>Update password</button>
      </form>
      <p role="status">{status}</p>
    </main>
  );
}
