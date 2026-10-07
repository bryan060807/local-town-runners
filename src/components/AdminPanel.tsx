import AdminRole from "./AdminRole";
import { db } from "@/lib/server/db";
import AdminModeration from "./AdminModeration";
export default async function AdminPanel() {
  const c = await db();
  const { data: allowed } = await c.rpc("has_role", { wanted: "admin" });
  if (!allowed) return null;
  const [users, vendors, runners, listings, reports, payments] =
    await Promise.all([
      c.from("profiles").select("id,display_name,suspended").limit(100),
      c.from("vendors").select("id,name,active,demo").limit(100),
      c
        .from("runners")
        .select("id,display_name,available_until,reward_points,completed_runs")
        .limit(100),
      c.from("listings").select("id,title,active").limit(100),
      c.from("reports").select("id,reason,listing_id,resolved").limit(100),
      c
        .from("payment_events")
        .select("event_id,order_id,capture_id,created_at")
        .limit(100),
    ]);
  if (
    [users, vendors, runners, listings, reports, payments].some((r) => r.error)
  )
    return <p>Admin data could not be loaded.</p>;
  return (
    <section>
      <h2>Admin / moderation</h2>
      <details className="simple-card">
        <summary>Accounts</summary>
        {users.data?.map((u) => (
          <p key={u.id}>
            {u.display_name} · {u.id}{" "}
            <AdminModeration id={u.id} type="profile" disabled={u.suspended} />
            <AdminRole id={u.id} />
          </p>
        ))}
      </details>
      <details className="simple-card">
        <summary>Vendors</summary>
        {vendors.data?.map((v) => (
          <p key={v.id}>
            {v.name} · {v.demo ? "DEMO" : "Marketplace"}{" "}
            <AdminModeration id={v.id} type="vendor" disabled={!v.active} />
          </p>
        ))}
      </details>
      <details className="simple-card">
        <summary>Listings</summary>
        {listings.data?.map((l) => (
          <p key={l.id}>
            {l.title}{" "}
            <AdminModeration id={l.id} type="listing" disabled={!l.active} />
          </p>
        ))}
      </details>
      <details className="simple-card">
        <summary>Runners</summary>
        {runners.data?.map((r) => (
          <p key={r.id}>
            {r.display_name} · {r.completed_runs} runs · {r.reward_points}{" "}
            demonstration points · available until{" "}
            {r.available_until || "not available"}
          </p>
        ))}
      </details>
      <details className="simple-card">
        <summary>Reports</summary>
        {reports.data?.map((r) => (
          <p key={r.id}>
            {r.reason} · {r.resolved ? "resolved" : "open"} · {r.listing_id}
          </p>
        ))}
      </details>
      <details className="simple-card">
        <summary>Sandbox payment events</summary>
        {payments.data?.map((p) => (
          <p key={p.event_id}>
            {p.event_id} · {p.capture_id} · {p.order_id}
          </p>
        ))}
      </details>
    </section>
  );
}
