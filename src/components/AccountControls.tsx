"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function AccountControls({
  name,
  email,
  verified,
  privacy,
  addresses,
}: {
  name: string;
  email: string;
  verified: boolean;
  privacy: { communication: string; analytics_consent: boolean } | null;
  addresses: {
    id: string;
    label: string;
    address: string;
    instructions: string;
  }[];
}) {
  const router = useRouter();
  const [display, setDisplay] = useState(name),
    [communication, setCommunication] = useState(
      privacy?.communication ?? "essential",
    ),
    [analytics, setAnalytics] = useState(privacy?.analytics_consent ?? false),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [deletion, setDeletion] = useState("");
  async function post(url: string, p: unknown) {
    setBusy(true);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus(d.message ?? "Saved.");
      router.refresh();
      return true;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Update failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="simple-card">
        <h2>Profile and privacy</h2>
        <p>
          {email} · {verified ? "Email verified" : "Email verification pending"}
        </p>
        {!verified && (
          <button
            disabled={busy}
            onClick={() => post("/api/auth", { action: "resend", email })}
          >
            Request verification email
          </button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void post("/api/account", {
              action: "profile",
              name: display,
              communication,
              analytics,
            });
          }}
        >
          <label>
            Display name
            <input
              required
              minLength={2}
              maxLength={150}
              value={display}
              onChange={(e) => setDisplay(e.target.value)}
            />
          </label>
          <label>
            Communication preferences
            <select
              value={communication}
              onChange={(e) => setCommunication(e.target.value)}
            >
              <option value="essential">
                Essential account and order messages
              </option>
              <option value="email">Also allow optional email updates</option>
            </select>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
            />
            Allow optional analytics (off by default)
          </label>
          <button disabled={busy}>Save profile and privacy preferences</button>
        </form>
      </section>
      <section className="simple-card">
        <h2>Private delivery addresses</h2>
        {addresses.map((a) => (
          <article key={a.id}>
            <h3>{a.label}</h3>
            <p>{a.address}</p>
            <p>{a.instructions}</p>
            <button
              disabled={busy}
              onClick={() =>
                post("/api/account", { action: "removeAddress", id: a.id })
              }
            >
              Remove {a.label}
            </button>
          </article>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = e.currentTarget;
            const d = new FormData(f);
            void post("/api/account", {
              action: "address",
              label: d.get("label"),
              address: d.get("address"),
              instructions: d.get("instructions"),
            }).then((ok) => {
              if (ok) f.reset();
            });
          }}
        >
          <label>
            Address label
            <input name="label" required maxLength={60} />
          </label>
          <label>
            Private delivery address
            <textarea name="address" required minLength={8} maxLength={500} />
          </label>
          <label>
            Delivery instructions
            <textarea name="instructions" maxLength={500} />
          </label>
          <button disabled={busy}>Save private address</button>
        </form>
      </section>
      <section className="simple-card">
        <h2>Sessions and account deletion</h2>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const r = await fetch("/api/auth", { method: "DELETE" });
            if (r.ok) router.push("/login");
            else {
              setStatus("Sign-out failed. Try again.");
              setBusy(false);
            }
          }}
        >
          Sign out of this session
        </button>
        <p>
          Deletion requests suspend marketplace access. Necessary transaction,
          consent and audit records remain for review and retention obligations.
          No immediate history deletion is performed.
        </p>
        <label>
          Type REQUEST DELETION to request account deletion
          <input
            value={deletion}
            onChange={(e) => setDeletion(e.target.value)}
          />
        </label>
        <button
          disabled={busy || deletion !== "REQUEST DELETION"}
          onClick={async () => {
            if (
              await post("/api/account", {
                action: "delete",
                confirm: deletion,
              })
            )
              router.push("/login");
          }}
        >
          Request account deletion
        </button>
      </section>
      <p role="status">{status}</p>
    </>
  );
}
