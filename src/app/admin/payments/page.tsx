import Link from "next/link";
import { adminUser } from "@/lib/server/onboarding";
import AdminPaymentRecovery from "@/components/AdminPaymentRecovery";
import PayPalDiagnostics from "@/components/PayPalDiagnostics";
export const dynamic = "force-dynamic";
export default async function Page() {
  try {
    await adminUser(true);
  } catch {
    return (
      <main className="simple-page">
        <h1>Administrator access required</h1>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }
  return (
    <main className="simple-page">
      <Link href="/account">← Account</Link>
      <h1>PayPal Sandbox authentication check</h1>
      <p>
        This checks the credentials used by this deployment. It does not create
        an order or charge a buyer. Credential values and access tokens are
        never displayed. The fingerprint identifies the public client ID only.
      </p>
      <PayPalDiagnostics />
      <AdminPaymentRecovery />
    </main>
  );
}
