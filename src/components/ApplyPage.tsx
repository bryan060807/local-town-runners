import Link from "next/link";
import { redirect } from "next/navigation";
import { realUser } from "@/lib/server/onboarding";
import ApplicationForm from "./ApplicationForm";
import { Agreement } from "./AgreementConsent";
export default async function ApplyPage({
  role,
}: {
  role: "vendor" | "runner";
}) {
  let user;
  try {
    user = await realUser(true);
  } catch {
    redirect("/login");
  }
  const [{ data: profile }, { data: agreement }, { data: application }] =
    await Promise.all([
      user.client
        .from("profiles")
        .select("email_verified_at")
        .eq("id", user.user.id)
        .single(),
      user.client
        .from("agreement_versions")
        .select("*")
        .eq("kind", role)
        .eq("active", true)
        .maybeSingle(),
      user.client
        .from("role_applications")
        .select("id,status,payload")
        .eq("user_id", user.user.id)
        .eq("role", role)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  return (
    <main className="simple-page onboarding-page">
      <Link href="/account">← Account</Link>
      <h1>{role === "vendor" ? "Vendor" : "Runner"} application</h1>
      {!profile?.email_verified_at ? (
        <p>
          Verify your email before submitting. Return to your account to request
          a verification email.
        </p>
      ) : (
        <ApplicationForm
          role={role}
          email={user.user.email ?? ""}
          agreement={agreement as Agreement | null}
          existing={application}
        />
      )}
    </main>
  );
}
