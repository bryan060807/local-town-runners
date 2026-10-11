// Read-only Sandbox/hosted evidence. Never creates, approves, captures or reconciles.
// node --use-env-proxy --use-system-ca scripts/phase43-payment-audit.mjs [marketplace-order-uuid]
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const base = "https://api-m.sandbox.paypal.com";
const expectedWebhook = "https://runners.aibrylabs.com/api/webhooks/paypal";
const existingCaptures = ["2RA30218PE716183N", "44G98547CY6197247"];
const suppliedOrder = process.argv[2];
if (
  suppliedOrder &&
  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    suppliedOrder,
  )
)
  throw Error("Use an existing marketplace order UUID");
for (const name of [
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
])
  if (!process.env[name]) throw Error(`Missing binding: ${name}`);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);
const fingerprint = (data) =>
  createHash("sha256").update(JSON.stringify(data)).digest("hex");
const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
  signal: AbortSignal.timeout(20000),
});
if (!tokenResponse.ok)
  throw Error(`Sandbox OAuth HTTP ${tokenResponse.status}`);
const token = (await tokenResponse.json()).access_token;
async function read(path) {
  if (
    !path.startsWith("/v2/checkout/orders/") &&
    !path.startsWith("/v2/payments/captures/") &&
    !path.startsWith("/v1/notifications/")
  )
    throw Error("Read-only endpoint allowlist rejected request");
  const response = await fetch(base + path, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw Error(`Sandbox GET ${path.split("?")[0]} HTTP ${response.status}`);
  return response.json();
}
async function query(builder) {
  const { data, error } = await builder;
  if (error) throw Error(`Database read ${error.code}`);
  return data;
}
async function snapshot(o) {
  const [ledger, events, recovery] = await Promise.all([
    query(db.from("ledger").select("*").eq("order_id", o.id).order("id")),
    query(
      db
        .from("payment_events")
        .select("*")
        .eq("order_id", o.id)
        .order("event_id"),
    ),
    query(db.from("payment_recovery").select("*").eq("order_id", o.id)),
  ]);
  return {
    order: {
      id: o.id,
      state: o.state,
      total_cents: o.total_cents,
      paypal_order_id: o.paypal_order_id,
      paypal_capture_id: o.paypal_capture_id,
      payout_status: o.payout_status,
    },
    ledger: ledger.map(({ kind, amount_cents, simulated }) => ({
      kind,
      amount_cents,
      simulated,
    })),
    paymentEvents: events.map(({ event_id, capture_id }) => ({
      event_id,
      capture_id,
    })),
    snapshotHash: fingerprint({ order: o, ledger, events, recovery }),
  };
}
function providerSummary(order, local) {
  const units = order.purchase_units ?? [];
  const buyerId =
    order.payment_source?.paypal?.account_id ?? order.payer?.payer_id;
  const sellers = units.map((p) => p.payee?.merchant_id).filter(Boolean);
  return {
    id: order.id,
    status: order.status,
    intent: order.intent,
    paymentSourceKinds: Object.keys(order.payment_source ?? {}),
    buyerDistinctFromSeller:
      buyerId && sellers.length ? sellers.every((s) => s !== buyerId) : null,
    // Seller merchant IDs are identifiers, not credentials; buyer identity is omitted.
    sellerMerchantIds: sellers,
    purchaseUnits: units.map((p) => ({
      custom_id: p.custom_id,
      amount: p.amount,
      captures: (p.payments?.captures ?? []).map((c) => ({
        id: c.id,
        status: c.status,
        pendingReason: c.status_details?.reason ?? null,
        amount: c.amount,
        final_capture: c.final_capture,
      })),
    })),
    localAssociationMatches: local
      ? units.length === 1 &&
        units[0].custom_id === local.id &&
        order.id === local.paypal_order_id
      : null,
  };
}
const evidence = {
  recordedAt: new Date().toISOString(),
  financialMutations: 0,
  oauth: "Sandbox HTTP 200",
  existing: [],
};
for (const id of existingCaptures) {
  const capture = await read(`/v2/payments/captures/${id}`);
  const paypalId = capture.supplementary_data?.related_ids?.order_id;
  if (!paypalId)
    throw Error("Capture omitted related order; no association guessed");
  const local = await query(
    db.from("orders").select("*").eq("paypal_order_id", paypalId).maybeSingle(),
  );
  const canonical = await read(
    `/v2/checkout/orders/${encodeURIComponent(paypalId)}`,
  );
  evidence.existing.push({
    capture: {
      id: capture.id,
      status: capture.status,
      pendingReason: capture.status_details?.reason ?? null,
      amount: capture.amount,
      paypalOrderId: paypalId,
    },
    canonical: providerSummary(canonical, local),
    local: local ? await snapshot(local) : null,
  });
}
const { webhooks = [] } = await read("/v1/notifications/webhooks");
evidence.webhooks = webhooks.map((h) => ({
  id: h.id,
  url: h.url,
  events: h.event_types?.map((e) => e.name),
  productionUrlMatches: h.url === expectedWebhook,
  configuredIdMatches: h.id === process.env.PAYPAL_WEBHOOK_ID,
}));
if (suppliedOrder) {
  const local = await query(
    db.from("orders").select("*").eq("id", suppliedOrder).single(),
  );
  evidence.testOrder = {
    local: await snapshot(local),
    canonical: local.paypal_order_id
      ? providerSummary(
          await read(
            `/v2/checkout/orders/${encodeURIComponent(local.paypal_order_id)}`,
          ),
          local,
        )
      : null,
  };
  if (local.paypal_order_id) {
    const params = new URLSearchParams({
      start_time: new Date(local.created_at)
        .toISOString()
        .replace(/\.\d{3}Z$/, "Z"),
      end_time: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
      page_size: "10",
    });
    try {
      const history = await read(`/v1/notifications/webhooks-events?${params}`);
      const matching = (history.events ?? []).filter(
        (e) =>
          e.resource?.supplementary_data?.related_ids?.order_id ===
          local.paypal_order_id,
      );
      evidence.testOrder.webhookHistory = matching.map((e) => ({
        id: e.id,
        event_type: e.event_type,
        captureId: e.resource?.id,
        captureStatus: e.resource?.status,
        amount: e.resource?.amount,
        delivery_status: e.delivery_status ?? null,
        localEventRecorded: evidence.testOrder.local.paymentEvents.some(
          (p) => p.event_id === e.id && p.capture_id === e.resource?.id,
        ),
      }));
      evidence.testOrder.webhookHistoryPaging = {
        returned: history.events?.length ?? 0,
        hasMore: (history.links ?? []).some((l) => l.rel === "next"),
      };
    } catch (error) {
      evidence.testOrder.webhookHistoryError = error.message;
    }
  }
}
console.log(JSON.stringify(evidence, null, 2));
