"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import AgreementConsent, { Agreement } from "./AgreementConsent";
export default function CustomerConsent({
  agreement,
  retryId,
}: {
  agreement?: Agreement;
  retryId?: string;
}) {
  const [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  if (agreement)
    return (
      <>
        <AgreementConsent
          agreement={agreement}
          onSaved={(s) => {
            setStatus(s);
            router.refresh();
          }}
        />
        <p role="status">{status}</p>
      </>
    );
  return (
    <>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "retryDocument",
                submissionId: retryId,
              }),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error);
            setStatus(
              d.documentReady
                ? "Private PDF ready."
                : "PDF pending; consent is retained.",
            );
            router.refresh();
          } catch (e) {
            setStatus(e instanceof Error ? e.message : "Retry failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        Retry PDF generation
      </button>
      <p role="status">{status}</p>
    </>
  );
}
