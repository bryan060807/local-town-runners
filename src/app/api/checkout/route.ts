import { z } from "zod";
import { authenticated, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
import { paypal } from "@/lib/server/paypal";
import { paypalConfig } from "@/lib/server/env";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, z.object({ orderId: z.uuid() }).strict());
    const { client, user } = await authenticated();
    await limited(client, "checkout");
    const { data: o, error } = await client
      .from("orders")
      .select("*")
      .eq("id", p.orderId)
      .eq("customer_id", user.id)
      .single();
    if (error || !o || !["DRAFT", "PENDING_PAYMENT"].includes(o.state))
      throw new HttpError("Order not payable", 409);
    const { data: address } = await client
      .from("order_private")
      .select("order_id")
      .eq("order_id", o.id)
      .single();
    if (!address)
      throw new HttpError(
        "Add a private delivery address before checkout",
        409,
      );
    const app = paypalConfig().app;
    const result = o.paypal_order_id
      ? await paypal(
          `/v2/checkout/orders/${encodeURIComponent(o.paypal_order_id)}`,
        )
      : await paypal(
          "/v2/checkout/orders",
          {
            intent: "CAPTURE",
            purchase_units: [
              {
                custom_id: o.id,
                amount: {
                  currency_code: "USD",
                  value: (o.total_cents / 100).toFixed(2),
                },
              },
            ],
            payment_source: {
              paypal: {
                experience_context: {
                  user_action: "PAY_NOW",
                  shipping_preference: "NO_SHIPPING",
                  return_url: `${app}/dashboard?approved=${o.id}`,
                  cancel_url: `${app}/dashboard?cancelled=${o.id}`,
                },
              },
            },
          },
          `create-${o.id}`,
        );
    const { error: save } = await client.rpc("attach_paypal_order", {
      order_id: o.id,
      paypal_id: result.id,
    });
    if (save) throw save;
    const link = result.links?.find((l: { rel: string; href: string }) =>
      ["approve", "payer-action"].includes(l.rel),
    );
    if (!link || !new URL(link.href).hostname.endsWith(".paypal.com"))
      throw Error("Approval link unavailable");
    return Response.json({ approvalUrl: link.href });
  } catch (e) {
    return failure(e);
  }
}
