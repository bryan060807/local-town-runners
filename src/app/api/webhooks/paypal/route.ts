import { readLimited } from "@/lib/request-body";
import { processWebhook } from "@/lib/webhook-processing";
import { serviceDb } from "@/lib/server/db";
import { failure } from "@/lib/server/http";
import { paypal, verifyWebhook } from "@/lib/server/paypal";
export async function POST(req: Request) {
  try {
    const event = JSON.parse(await readLimited(req, 100000));
    const result = await processWebhook(event, {
      verify: (e) => verifyWebhook(req.headers, e),
      findOrder: async (id) => {
        const { data, error } = await serviceDb()
          .from("orders")
          .select("id,total_cents")
          .eq("paypal_order_id", id)
          .maybeSingle();
        if (error) throw error;
        return data;
      },
      canonical: (id) =>
        paypal(`/v2/checkout/orders/${encodeURIComponent(id)}`),
      confirm: async (o, capture, event) => {
        const { error } = await serviceDb().rpc("confirm_payment", {
          order_id: o.id,
          capture_id: capture,
          event_id: event,
          amount_cents: o.total_cents,
        });
        if (error) throw error;
      },
    });
    return Response.json({ message: result.body }, { status: result.status });
  } catch (e) {
    return failure(e);
  }
}
