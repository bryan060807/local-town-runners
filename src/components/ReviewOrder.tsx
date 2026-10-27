"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function ReviewOrder({
  id,
  existing,
}: {
  id: string;
  existing?: { rating: number; comment: string };
}) {
  const router = useRouter();
  const [rating, setRating] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function review(e: React.FormEvent) {
    e.preventDefault();
    if (busy || existing) return;
    setBusy(true);
    try {
      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id, rating: Number(rating), comment }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus("Review saved. Thank you, neighbor.");
      router.refresh();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Review unavailable");
    } finally {
      setBusy(false);
    }
  }
  if (existing)
    return (
      <details>
        <summary>Your completed-order review · {existing.rating} / 5</summary>
        <p>{existing.comment || "Star rating submitted."}</p>
        <p role="status">Review saved. Thank you, neighbor.</p>
      </details>
    );
  return (
    <details>
      <summary>Leave a review</summary>
      <form onSubmit={review}>
        <p>
          Share an honest account of this completed order. A review with at
          least 20 characters earns 5 community points, whatever star rating you
          choose.
        </p>
        <fieldset
          disabled={busy}
          style={{ border: 0, padding: 0, minWidth: 0 }}
        >
          <label>
            Rating out of five
            <input
              type="number"
              min={1}
              max={5}
              required
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            />
          </label>
          <label>
            Your review
            <input
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </label>
          <button>{busy ? "Saving review…" : "Save review"}</button>
        </fieldset>
        <p role="status">{status}</p>
      </form>
    </details>
  );
}
