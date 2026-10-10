import Link from "next/link";
import { adminUser } from "@/lib/server/onboarding";
import PrivateDocument from "@/components/PrivateDocument";
import OnboardingReview from "@/components/OnboardingReview";
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  let a;
  try {
    a = await adminUser(true);
  } catch {
    return (
      <main className="simple-page">
        <h1>Administrator access required</h1>
        <p>This area is restricted to authorized platform administrators.</p>
        <Link href="/login">Sign in</Link>
      </main>
    );
  }
  const p = await searchParams;
  let query = a.client
    .from("role_applications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (
    ["draft", "submitted", "under_review", "approved", "rejected"].includes(
      p.status ?? "",
    )
  )
    query = query.eq("status", p.status!);
  const [
    apps,
    submissions,
    documents,
    notifications,
    decisions,
    profiles,
    audit,
    assets,
    presentations,
  ] = await Promise.all([
    query,
    a.client
      .from("agreement_submissions")
      .select("id,application_id,user_id,kind,version,created_at"),
    a.client.from("agreement_documents").select("*"),
    a.client.from("notification_deliveries").select("*"),
    a.client
      .from("application_decisions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    a.client
      .from("profiles")
      .select("id,display_name,lifecycle,suspended,demo_workspace")
      .is("demo_workspace", null)
      .limit(100),
    a.client
      .from("audit_events")
      .select("event,resource_id,created_at")
      .like("event", "APPLICATION_%")
      .order("created_at", { ascending: false })
      .limit(100),
    a.client.from("application_assets").select("id,application_id"),
    a.client.from("agreement_presentations").select("submission_id"),
  ]);
  const filtered = apps.data?.filter(
    (x) =>
      !p.q ||
      `${x.id} ${x.payload.name} ${x.role}`
        .toLowerCase()
        .includes(p.q.slice(0, 150).toLowerCase()),
  );
  return (
    <main className="simple-page onboarding-page">
      <Link href="/account">← Account</Link>
      <h1>Onboarding administration</h1>
      <Link href="/admin/payments">
        PayPal Sandbox authentication diagnostics
      </Link>
      <p>
        Approval activates Sandbox participation only. Identity, insurance and
        background checks remain unverified. Email “accepted” means the provider
        accepted the request; inbox delivery needs separate verification.
      </p>
      <form method="GET">
        <label>
          Search applications
          <input name="q" maxLength={150} defaultValue={p.q} />
        </label>
        <label>
          Application status
          <select name="status" defaultValue={p.status ?? ""}>
            <option value="">All statuses</option>
            {["draft", "submitted", "under_review", "approved", "rejected"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </label>
        <button>Filter applications</button>
      </form>
      <h2>Vendor and runner applications</h2>
      {filtered?.map((x) => {
        const s = submissions.data?.find((s) => s.application_id === x.id),
          d = documents.data?.find((d) => d.submission_id === s?.id),
          n = notifications.data?.find((n) => n.submission_id === s?.id);
        return (
          <article className="simple-card" key={x.id}>
            <h3>
              {x.payload.name} · {x.role}
            </h3>
            <p>
              Application {x.id} · {x.status.replaceAll("_", " ")} · Submitted{" "}
              {x.submitted_at ?? "not submitted"}
            </p>
            <pre className="application-details">
              {JSON.stringify(x.payload, null, 2)}
            </pre>
            {assets.data
              ?.filter((v) => v.application_id === x.id)
              .map((v) => (
                <PrivateDocument key={v.id} id={v.id} photo />
              ))}
            {s && (
              <>
                <p>
                  Agreement {s.version} · Consent {s.created_at} · PDF{" "}
                  {d?.path ? "ready" : (d?.error_code ?? "pending")}
                </p>
                <PrivateDocument id={s.id} />
                {presentations.data?.some((p) => p.submission_id === s.id) && (
                  <PrivateDocument id={s.id} presentation />
                )}
                <p>
                  Admin notification:{" "}
                  {n?.job_status ?? n?.status ?? "not queued"} · Attempts{" "}
                  {n?.attempts ?? 0} · {n?.error_code}
                  <br />
                  Last attempt: {n?.last_attempt_at ?? "Not recorded"}
                  <br />
                  Provider:{" "}
                  {n?.provider_event ??
                    (n?.provider_id ? "accepted" : "unconfirmed")}{" "}
                  · Message ID: {n?.provider_id ?? "none"}
                  <br />
                  {n?.provider_event === "delivered"
                    ? "Provider reports delivery; inbox placement is not confirmed."
                    : "Inbox delivery is unconfirmed."}
                </p>
              </>
            )}
            <OnboardingReview
              applicationId={x.id}
              submissionId={s?.id}
              notificationRetry={
                !!n && !n.provider_id && n.status !== "accepted"
              }
              finalized={["draft", "approved", "rejected"].includes(x.status)}
            />
            {decisions.data
              ?.filter((v) => v.application_id === x.id)
              .map((v) => (
                <p key={v.id}>
                  Review {v.created_at}: {v.decision} — {v.notes}
                </p>
              ))}
          </article>
        );
      })}
      <h2>Customer accounts and lifecycle</h2>
      {profiles.data?.map((x) => (
        <article className="simple-card" key={x.id}>
          <h3>{x.display_name}</h3>
          <p>
            {x.id} · {x.lifecycle} ·{" "}
            {x.suspended ? "Suspended" : "Access enabled"}
          </p>
          <OnboardingReview userId={x.id} suspended={x.suspended} />
          {submissions.data
            ?.filter((s) => s.user_id === x.id && s.kind === "customer")
            .map((s) => (
              <PrivateDocument key={s.id} id={s.id} />
            ))}
        </article>
      ))}
      <h2>Application audit history</h2>
      {audit.data?.map((x, i) => (
        <p key={i}>
          {x.created_at} · {x.event} · {x.resource_id}
        </p>
      ))}
    </main>
  );
}
