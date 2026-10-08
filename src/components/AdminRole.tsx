import Link from "next/link";
export default function AdminRole({ id }: { id: string }) {
  return (
    <p>
      Account {id}:{" "}
      <Link href="/admin/onboarding">Review role applications</Link>.
      Administrator membership requires operator bootstrap.
    </p>
  );
}
