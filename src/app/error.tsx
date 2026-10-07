"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="simple-page">
      <h1>We couldn’t load that just now.</h1>
      <p>
        Please try again. Your payment state is always confirmed by the server.
      </p>
      <button className="primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
