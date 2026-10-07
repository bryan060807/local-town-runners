"use client";
import { useState } from "react";
export default function ReviewOrder({ id }: { id: string }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState("");
  async function review(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id, rating, comment }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setStatus("Review saved. Thank you, neighbor.");
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Review unavailable");
    }
  }
  return (
    <details>
      <summary>Leave a review</summary>
      <form onSubmit={review}>
        <label>
          Rating out of five
          <input
            type="number"
            min={1}
            max={5}
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
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
        <button>Save review</button>
        <p role="status">{status}</p>
      </form>
    </details>
  );
}
