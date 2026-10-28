"use client";
import Link from "next/link";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="simple-page">
      <h1>We couldn’t load that just now.</h1>
      <p>Something interrupted this page. Please try again.</p>
      <button className="primary" onClick={retry}>
        Try again
      </button>
      <p>
        <Link href="/">Back to Explore</Link>
      </p>
    </main>
  );
}
