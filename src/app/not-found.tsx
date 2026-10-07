import Link from "next/link";
export default function NotFound() {
  return (
    <main className="simple-page">
      <h1>This find has moved on.</h1>
      <p>The listing or profile is unavailable.</p>
      <Link href="/">Back to the neighborhood →</Link>
    </main>
  );
}
