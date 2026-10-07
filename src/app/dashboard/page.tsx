import UploadAsset from "@/components/UploadAsset";
import Link from "next/link";
import ReviewOrder from "@/components/ReviewOrder";
import VendorCreate from "@/components/VendorCreate";
import VendorEditor from "@/components/VendorEditor";
import AdminPanel from "@/components/AdminPanel";
import RunnerTrip from "@/components/RunnerTrip";
import { configured } from "@/lib/server/env";
import { db } from "@/lib/server/db";
import { brand } from "@/lib/brand";
import { money } from "@/lib/catalog";
import DashboardActions from "@/components/DashboardActions";
import RunnerControls from "@/components/RunnerControls";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Dashboard() {
  if (!configured())
    return (
      <main className="simple-page">
        <Link href="/">← {brand.name}</Link>
        <h1>Your neighborhood hub.</h1>
        <p>
          Browse the demo marketplace today. Account dashboards require a
          configured Supabase project and database migrations.
        </p>
        <div className="simple-card">
          <h2>Vendors</h2>
          <p>
            Manage your own catalog, accept paid orders and confirm pickup
            readiness.
          </p>
        </div>
        <div className="simple-card">
          <h2>Runners</h2>
          <p>
            Set temporary availability, share a trip intention, and accept
            compatible pickups. Public locations are approximate.
          </p>
        </div>
        <Link href="/">Explore the demo →</Link>
      </main>
    );
  const client = await db();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const [
    { data: roles },
    { data: profile },
    { data: orders },
    { data: ledger },
  ] = await Promise.all([
    client.from("user_roles").select("role").eq("user_id", user.id),
    client
      .from("profiles")
      .select("display_name,suspended")
      .eq("id", user.id)
      .single(),
    client
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    client
      .from("ledger")
      .select("order_id,kind,amount_cents,simulated")
      .limit(100),
  ]);
  if (profile?.suspended)
    return (
      <main className="simple-page">
        <h1>Account suspended.</h1>
        <p>Contact the marketplace administrator.</p>
      </main>
    );
  const roleNames = roles?.map((r) => r.role) || [];
  const { data: events, error: eventError } = await client
    .from("order_events")
    .select("id,order_id,event,created_at")
    .order("created_at", { ascending: true })
    .limit(200);
  if (eventError) throw eventError;
  const [{ data: deliveryAddresses }, { data: pickupAddresses }] =
    await Promise.all([
      client.from("order_private").select("order_id,delivery_address"),
      client.from("vendor_private").select("vendor_id,pickup_address"),
    ]);
  const { data: owned } = await client
    .from("vendors")
    .select("id,name")
    .eq("owner_id", user.id);
  const ownedIds = owned?.map((v) => v.id) || [];
  const { data: vendorListings } = ownedIds.length
    ? await client
        .from("listings")
        .select("id,vendor_id,title,inventory,price_cents,active")
        .in("vendor_id", ownedIds)
    : { data: [] };
  const { data: publicVendors } = await client
    .from("vendors")
    .select("id,name")
    .eq("active", true);
  const { data: runnerProfile } = roleNames.includes("runner")
    ? await client
        .from("runners")
        .select("completed_runs,reward_points")
        .eq("id", user.id)
        .single()
    : { data: null };
  const { data: runs } = roleNames.includes("runner")
    ? await client.rpc("available_runs")
    : { data: [] };
  const { data: audit } = roleNames.includes("admin")
    ? await client
        .from("audit_events")
        .select("id,event,created_at")
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] };
  return (
    <main className="simple-page">
      <Link href="/">← {brand.name}</Link>
      <h1>Hello, {profile?.display_name || "neighbor"}.</h1>
      <p>
        Your roles: {roleNames.join(", ")}. Roles are assigned by an
        administrator, never by browser state.
      </p>
      {roleNames.includes("runner") && (
        <div className="simple-card">
          <h2>Runner availability</h2>
          <RunnerControls />
          <UploadAsset label="Runner avatar" data={{ target: "runner" }} />
          <RunnerTrip vendors={publicVendors || []} />
          <p>
            {runnerProfile?.completed_runs || 0} completed runs ·{" "}
            {runnerProfile?.reward_points || 0} demo rewards points
          </p>
          {runs?.map((r: { id: string; vendor_name: string }) => (
            <div key={r.id}>
              <p>
                Pickup at {r.vendor_name} · exact delivery address stays private
                until assignment.
              </p>
              <DashboardActions orderId={r.id} actions={["Accept run"]} />
            </div>
          ))}
        </div>
      )}
      {roleNames.includes("vendor") && (
        <section>
          <h2>Your catalog</h2>
          <VendorCreate vendors={owned || []} />
          {vendorListings?.map((l) => (
            <VendorEditor
              key={l.id}
              id={l.id}
              vendorId={l.vendor_id}
              title={l.title}
              inventory={l.inventory}
              price={Number(l.price_cents)}
              active={l.active}
            />
          ))}
        </section>
      )}
      <h2>Your orders</h2>
      {!orders?.length && (
        <p>No orders yet. Find something in your neighborhood.</p>
      )}
      {orders?.map((o) => {
        const actions: string[] = [];
        if (o.customer_id === user.id && o.state === "DRAFT")
          actions.push("Cancel draft");
        if (
          o.customer_id === user.id &&
          ["DRAFT", "PENDING_PAYMENT"].includes(o.state)
        )
          actions.push("Pay with PayPal Sandbox");
        if (o.customer_id === user.id && o.state === "PENDING_PAYMENT")
          actions.push("Confirm approved payment");
        if (ownedIds.includes(o.vendor_id)) {
          if (o.state === "PAID") actions.push("VENDOR_ACCEPTED");
          if (o.state === "VENDOR_ACCEPTED") actions.push("RUNNER_MATCHING");
          if (o.state === "RUNNER_ASSIGNED") actions.push("READY_FOR_PICKUP");
        }
        if (o.runner_id === user.id) {
          if (o.state === "READY_FOR_PICKUP") actions.push("PICKED_UP");
          if (o.state === "PICKED_UP") actions.push("OUT_FOR_DELIVERY");
          if (o.state === "OUT_FOR_DELIVERY") actions.push("DELIVERED");
        }
        if (o.customer_id === user.id && o.state === "DELIVERED")
          actions.push("COMPLETED");
        return (
          <div className="simple-card" key={o.id}>
            <h2>
              {money(Number(o.total_cents))} · {o.state.replaceAll("_", " ")}
            </h2>
            <p>
              Order {o.id} · Quantity {o.quantity}
            </p>
            <p>
              Vendor/runner allocations are simulated. No payout is disbursed.
            </p>
            <DashboardActions orderId={o.id} actions={actions} />
            <details>
              <summary>
                Private operational addresses (authorized participants only)
              </summary>
              {deliveryAddresses
                ?.filter((a) => a.order_id === o.id)
                .map((a) => (
                  <p key={a.order_id}>Delivery: {a.delivery_address}</p>
                ))}
              {pickupAddresses
                ?.filter((a) => a.vendor_id === o.vendor_id)
                .map((a) => (
                  <p key={a.vendor_id}>Pickup: {a.pickup_address}</p>
                ))}
            </details>
            {o.customer_id === user.id && o.state === "COMPLETED" && (
              <ReviewOrder id={o.id} />
            )}
            <details>
              <summary>Financial allocations and event history</summary>
              {events
                ?.filter((e) => e.order_id === o.id)
                .map((e) => (
                  <p key={e.id}>
                    {e.event} · {e.created_at}
                  </p>
                ))}
              {ledger
                ?.filter((l) => l.order_id === o.id)
                .map((l) => (
                  <p key={l.kind}>
                    {l.kind}: {money(Number(l.amount_cents))}{" "}
                    {l.simulated
                      ? "(simulated allocation)"
                      : "(Sandbox payment)"}
                  </p>
                ))}
            </details>
          </div>
        );
      })}
      {roleNames.includes("admin") && <AdminPanel />}
      {roleNames.includes("admin") && (
        <div className="simple-card">
          <h2>Administrative audit</h2>
          {audit?.map((a) => (
            <p key={a.id}>
              {a.event} · {a.created_at}
            </p>
          ))}
        </div>
      )}
    </main>
  );
}
