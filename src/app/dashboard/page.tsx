import PaymentSummary from "@/components/PaymentSummary";
import CustomerPreferences from "@/components/CustomerPreferences";
import InquiryCard from "@/components/InquiryCard";
import { demoAddress } from "@/lib/demo-catalog";
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
        <nav className="account-links">
          <Link href="/account">Real account settings</Link>
          <Link href="/vendor/apply">Vendor application</Link>
          <Link href="/runner/apply">Runner application</Link>
        </nav>
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
  const client = await db(true);
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) redirect("/login");
  const [
    { data: roles, error: roleError },
    { data: profile, error: profileError },
    { data: orders, error: ordersError },
    { data: owned, error: ownedError },
  ] = await Promise.all([
    client.from("user_roles").select("role").eq("user_id", user.id),
    client
      .from("profiles")
      .select("display_name,suspended,demo_workspace")
      .eq("id", user.id)
      .single(),
    client
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    client.from("vendors").select("id,name").eq("owner_id", user.id),
  ]);
  if (roleError || profileError || ordersError || ownedError)
    throw roleError || profileError || ordersError || ownedError;
  if (profile?.suspended)
    return (
      <main className="simple-page">
        <h1>Account suspended.</h1>
        <p>Contact the marketplace administrator.</p>
      </main>
    );
  const roleNames = roles?.map((r) => r.role) || [];
  const ownedIds = owned?.map((v) => v.id) || [];
  const orderIds = orders?.map((o) => o.id) || [];
  const pickupIds = [
    ...new Set([...ownedIds, ...(orders || []).map((o) => o.vendor_id)]),
  ];
  const [
    { data: preferences },
    { data: inquiries },
    { data: lineItems },
    { data: events, error: eventError },
    { data: ledger, error: ledgerError },
    { data: deliveryAddresses },
    { data: pickupAddresses },
    { data: vendorListings },
    { data: publicVendors },
    { data: runnerProfile },
    { data: runs },
    { data: audit },
  ] = await Promise.all([
    roleNames.includes("customer")
      ? client
          .from("customer_preferences")
          .select("delivery_address,delivery_notes")
          .eq("customer_id", user.id)
          .maybeSingle()
      : { data: null },
    client
      .from("inquiries")
      .select("id,customer_id,message,response,status")
      .order("created_at", { ascending: false })
      .limit(30),
    orderIds.length
      ? client
          .from("order_items")
          .select("order_id,listing_id,title,quantity,unit_price_cents")
          .in("order_id", orderIds)
      : { data: [] },
    orderIds.length
      ? client
          .from("order_events")
          .select("id,order_id,event,created_at")
          .in("order_id", orderIds)
          .order("created_at", { ascending: true })
          .limit(500)
      : { data: [], error: null },
    orderIds.length
      ? client
          .from("ledger")
          .select("order_id,kind,amount_cents,simulated")
          .in("order_id", orderIds)
          .limit(250)
      : { data: [], error: null },
    orderIds.length
      ? client
          .from("order_private")
          .select("order_id,delivery_address")
          .in("order_id", orderIds)
      : { data: [] },
    pickupIds.length
      ? client
          .from("vendor_private")
          .select("vendor_id,pickup_address")
          .in("vendor_id", pickupIds)
      : { data: [] },
    ownedIds.length
      ? client
          .from("listings")
          .select("id,vendor_id,title,inventory,price_cents,active")
          .in("vendor_id", ownedIds)
      : { data: [] },
    roleNames.includes("runner")
      ? client.from("vendors").select("id,name").eq("active", true)
      : { data: [] },
    roleNames.includes("runner")
      ? client
          .from("runners")
          .select(
            "completed_runs,reward_points,transportation,max_detour_miles,available_until",
          )
          .eq("id", user.id)
          .single()
      : { data: null },
    roleNames.includes("runner") ? client.rpc("available_runs") : { data: [] },
    roleNames.includes("admin")
      ? client
          .from("audit_events")
          .select("id,event,created_at")
          .order("created_at", { ascending: false })
          .limit(30)
      : { data: [] },
  ]);
  if (eventError || ledgerError) throw eventError || ledgerError;
  return (
    <main className="simple-page">
      <Link href="/">← {brand.name}</Link>
      {profile?.demo_workspace && (
        <span className="demo-tag">ISOLATED FICTIONAL DEMO</span>
      )}
      <h1>Hello, {profile?.display_name || "neighbor"}.</h1>
      <div className="role-navigation">
        <Link href="/">Explore marketplace</Link>
        <Link href="/cart">Shopping cart</Link>
        <Link href="/dashboard">Order tracking</Link>
        {!profile?.demo_workspace && (
          <Link href="/account">Account and applications</Link>
        )}
      </div>
      {roleNames.includes("customer") && (
        <CustomerPreferences
          address={
            preferences?.delivery_address ||
            (profile?.demo_workspace ? demoAddress : "")
          }
          notes={preferences?.delivery_notes || ""}
          demo={Boolean(profile?.demo_workspace)}
        />
      )}
      <PaymentSummary
        role={
          roleNames.includes("vendor")
            ? "vendor"
            : roleNames.includes("runner")
              ? "runner"
              : "customer"
        }
        ledger={ledger || []}
        orders={orders || []}
        configured={Boolean(
          process.env.PAYPAL_CLIENT_ID &&
          process.env.PAYPAL_CLIENT_SECRET &&
          process.env.PAYPAL_WEBHOOK_ID,
        )}
      />
      <p>
        Your roles: {roleNames.join(", ")}. Roles are assigned by an
        administrator, never by browser state.
      </p>
      {roleNames.includes("runner") && (
        <div className="simple-card">
          <h2>Runner availability</h2>
          <Link href={`/runners/${user.id}`}>
            View your public runner profile →
          </Link>
          <p>
            Transportation: {runnerProfile?.transportation || "Walking"} ·
            Maximum detour: {runnerProfile?.max_detour_miles ?? 3} miles ·
            Availability expires:{" "}
            {runnerProfile?.available_until || "Not available"}
          </p>
          <RunnerControls
            initialTransportation={runnerProfile?.transportation || "Walking"}
            initialDetour={Number(runnerProfile?.max_detour_miles ?? 3)}
          />
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
              <DashboardActions
                orderId={r.id}
                actions={["Accept run", "Decline run"]}
              />
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
          if (o.state === "PAID" && o.refund_state === "NONE")
            actions.push("VENDOR_ACCEPTED");
          if (
            ["PAID", "VENDOR_ACCEPTED", "RUNNER_MATCHING"].includes(o.state) &&
            !o.runner_id &&
            o.refund_state !== "COMPLETED"
          )
            actions.push(
              o.refund_state === "PENDING"
                ? "Retry refund reconciliation"
                : "Decline and refund Sandbox payment",
            );
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
            {lineItems
              ?.filter((i) => i.order_id === o.id)
              .map((i) => (
                <p key={i.listing_id}>
                  {i.quantity} × {i.title} · {money(Number(i.unit_price_cents))}{" "}
                  each
                </p>
              ))}
            <p>
              Refund:{" "}
              {o.refund_state === "NONE" ? "None requested" : o.refund_state}
            </p>
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
              <p>
                PayPal order: {o.paypal_order_id || "Not created"} · Capture:{" "}
                {o.paypal_capture_id || "Not captured"} · Refund:{" "}
                {o.paypal_refund_id || "None"}
              </p>
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
      <h2>Quote inquiries and notifications</h2>
      {!inquiries?.length && (
        <p>
          No quote inquiries yet. Order events above are your fulfillment
          notifications.
        </p>
      )}
      {inquiries?.map((i) => (
        <InquiryCard
          key={i.id}
          id={i.id}
          message={i.message}
          response={i.response}
          vendor={i.customer_id !== user.id}
        />
      ))}
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
