import Link from "next/link";
import { redirect } from "next/navigation";
import { realUser } from "@/lib/server/onboarding";
import CustomerConsent from "@/components/CustomerConsent";
import AccountControls from "@/components/AccountControls";
import PrivateDocument from "@/components/PrivateDocument";
export const dynamic = "force-dynamic";
export default async function Page() {
  let a;
  try {
    a = await realUser(true);
  } catch {
    redirect("/login");
  }
  const [
    profile,
    privacy,
    addresses,
    applications,
    agreements,
    definition,
    roles,
  ] = await Promise.all([
    a.client.from("profiles").select("*").eq("id", a.user.id).single(),
    a.client
      .from("account_privacy")
      .select("*")
      .eq("user_id", a.user.id)
      .maybeSingle(),
    a.client.from("private_addresses").select("*").eq("user_id", a.user.id),
    a.client
      .from("role_applications")
      .select("id,role,status")
      .eq("user_id", a.user.id),
    a.client
      .from("agreement_submissions")
      .select("id,kind,version,created_at")
      .eq("user_id", a.user.id),
    a.client
      .from("agreement_versions")
      .select("*")
      .eq("kind", "customer")
      .eq("active", true)
      .maybeSingle(),
    a.client.from("user_roles").select("role,status").eq("user_id", a.user.id),
  ]);
  return (
    <main className="simple-page onboarding-page">
      <Link href="/">← Marketplace</Link>
      <h1>Your account</h1>
      <p>
        Account state: {profile.data?.lifecycle.replaceAll("_", " ")}.
        Authentication and marketplace role approval are separate.
      </p>
      <nav className="account-links">
        <Link href="/dashboard">Orders and dashboard</Link>
        <Link href="/vendor/apply">Apply as a vendor</Link>
        <Link href="/runner/apply">Apply as a runner</Link>
        {roles.data?.some(
          (r) => r.role === "admin" && r.status === "approved",
        ) && <Link href="/admin/onboarding">Administration</Link>}
      </nav>
      <AccountControls
        name={profile.data?.display_name ?? "Neighbor"}
        email={a.user.email ?? ""}
        verified={Boolean(profile.data?.email_verified_at)}
        privacy={privacy.data}
        addresses={addresses.data ?? []}
      />
      {!profile.data?.customer_terms &&
        profile.data?.email_verified_at &&
        definition.data && <CustomerConsent agreement={definition.data} />}
      <section className="simple-card">
        <h2>Role applications</h2>
        {applications.data?.length ? (
          applications.data.map((x) => (
            <p key={x.id}>
              {x.role}: {x.status.replaceAll("_", " ")}
            </p>
          ))
        ) : (
          <p>No vendor or runner applications submitted.</p>
        )}
        <h2>Consent receipts</h2>
        {agreements.data?.map((s) => (
          <article key={s.id}>
            <p>
              {s.kind} · {s.version} · {s.created_at}
            </p>
            <PrivateDocument id={s.id} />
            <CustomerConsent retryId={s.id} />
          </article>
        ))}
      </section>
      <Link href="/agreements">Read current agreements</Link>
    </main>
  );
}
