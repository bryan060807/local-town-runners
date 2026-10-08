"use client";
import { useState } from "react";
import SignaturePad from "./SignaturePad";
export type Agreement = {
  id: string;
  kind: string;
  version: string;
  title: string;
  sections: { heading: string; text: string }[];
};
export default function AgreementConsent({
  agreement,
  applicationId,
  onSaved,
}: {
  agreement: Agreement;
  applicationId?: string;
  onSaved: (receipt: string) => void;
}) {
  const [checks, setChecks] = useState<boolean[]>(
    agreement.sections.map(() => false),
  );
  const [name, setName] = useState("");
  const [signature, setSignature] = useState<number[][][]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          applicationId
            ? {
                action: "submit",
                applicationId,
                agreementId: agreement.id,
                typedName: name,
                signature,
                acknowledged: true,
                consent,
              }
            : {
                action: "customer",
                agreementId: agreement.id,
                typedName: name,
                consent,
              },
        ),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      onSaved(
        `Consent saved. Receipt ${d.submissionId}. ${d.documentReady ? "Private PDF ready." : "PDF generation pending; your consent is retained."} Notification: ${d.notification}.`,
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="consent-form">
      <h2>{agreement.title}</h2>
      <p>
        Version {agreement.version}. Read and acknowledge every section. Your
        accepted text and signature are retained as an immutable record.
      </p>
      {agreement.sections.map((s, i) => (
        <section className="agreement-section" key={i}>
          <h3>{s.heading}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{s.text}</p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={checks[i]}
              disabled={busy}
              onChange={(e) =>
                setChecks((v) =>
                  v.map((x, n) => (n === i ? e.target.checked : x)),
                )
              }
            />
            I have read section {i + 1}.
          </label>
        </section>
      ))}
      <label>
        Typed full name
        <input
          required
          minLength={2}
          maxLength={150}
          autoComplete="name"
          value={name}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {applicationId && (
        <SignaturePad
          value={signature}
          onChange={setSignature}
          disabled={busy}
        />
      )}
      <label className="check-row">
        <input
          type="checkbox"
          required
          checked={consent}
          disabled={busy}
          onChange={(e) => setConsent(e.target.checked)}
        />
        I explicitly agree to this version and intend to sign electronically.
      </label>
      <button
        className="primary"
        disabled={
          busy ||
          !checks.every(Boolean) ||
          !consent ||
          name.trim().length < 2 ||
          Boolean(applicationId && !signature.some((s) => s.length >= 2))
        }
      >
        {busy ? "Saving consent and generating receipt…" : "Submit agreement"}
      </button>
      <p role="status">{status}</p>
    </form>
  );
}
