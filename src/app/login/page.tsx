"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { brand } from "@/lib/brand";
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          action: signup ? "signup" : "signin",
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.confirmationRequired)
        setStatus("Check your email to confirm your account, then sign in.");
      else router.push(signup ? "/account" : "/dashboard");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="simple-page">
      <Link href="/">← {brand.name}</Link>
      <h1>{signup ? "Join your neighborhood." : "Welcome back, neighbor."}</h1>
      <p>
        Real accounts are powered by Supabase. Demo browsing is available
        without an account.
      </p>
      <form onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            minLength={12}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="primary" disabled={busy}>
          {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
        </button>
      </form>
      <p role="status">{status}</p>
      <p>
        <Link href="/agreements">Read Terms and Privacy Notice</Link>
      </p>
      <button
        type="button"
        disabled={busy || !email}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/auth", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "recover", email }),
            });
            const d = await r.json();
            setStatus(d.message || d.error);
          } finally {
            setBusy(false);
          }
        }}
      >
        Request password recovery email
      </button>
      <button onClick={() => setSignup((v) => !v)}>
        {signup ? "Already a neighbor? Sign in" : "New here? Create an account"}
      </button>
    </main>
  );
}
