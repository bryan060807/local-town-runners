"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function OnboardingReview({
  applicationId,
  submissionId,
  userId,
  suspended = false,
  finalized = false,
}: {
  applicationId?: string;
  submissionId?: string;
  userId?: string;
  suspended?: boolean;
  finalized?: boolean;
}) {
  const [notes, setNotes] = useState(""),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function post(p: unknown) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(p),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus(
        d.notification
          ? `Document ready: ${d.documentReady}. Notification: ${d.notification}.`
          : d.photoPublication
            ? `Review action saved. Photo publication: ${d.photoPublication}.`
            : "Review action saved.",
      );
      router.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {applicationId && !finalized && (
        <>
          <label>
            Internal review notes
            <textarea
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {(["under_review", "approved", "rejected"] as const).map(
            (decision) => (
              <button
                key={decision}
                disabled={busy}
                onClick={() =>
                  post({ action: "review", applicationId, decision, notes })
                }
              >
                {decision === "under_review"
                  ? "Start review"
                  : decision === "approved"
                    ? "Approve application"
                    : "Reject application"}
              </button>
            ),
          )}
        </>
      )}
      {submissionId && (
        <button
          disabled={busy}
          onClick={() => post({ action: "retry", submissionId })}
        >
          Retry PDF and notification
        </button>
      )}
      {userId && (
        <button
          disabled={busy}
          onClick={() =>
            post({ action: "suspend", userId, suspended: !suspended })
          }
        >
          {suspended ? "Restore account access" : "Suspend account"}
        </button>
      )}
      <p role="status">{status}</p>
    </div>
  );
}
