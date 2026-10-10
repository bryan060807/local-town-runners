import { DatabaseOperationError } from "@/lib/server/errors";
import {
  paymentMatchesOrder,
  paymentMatchesTotal,
} from "@/lib/payment-validation";
import { z } from "zod";
import { authenticated, serviceDb, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
import { paypal } from "@/lib/server/paypal";
import { recoverPayment } from "@/lib/server/payment-recovery";
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
    const service = serviceDb();
    const { data: ready, error: readyError } =
      await service.rpc("phase42_ready");
    if (readyError || !ready)
      throw new HttpError(
        "Apply the Phase 4.2 database migration before checkout",
        503,
      );
    const { error: preflight } = await service
      .from("orders")
      .select("id")
      .eq("id", o.id)
      .single();
    if (preflight) throw new HttpError("Payment database unavailable", 503);
    if (o.paypal_order_id) {
      const current = await recoverPayment({
        id: o.id,
        paypalId: o.paypal_order_id,
        totalCents: Number(o.total_cents),
      });
      if (current.payment.phase !== "awaiting_approval")
        return Response.json(current, {
          status: current.payment.phase === "confirmed" ? 200 : 202,
          headers: { "Cache-Control": "private, no-store" },
        });
    }
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
    if (
      typeof result.id !== "string" ||
      !result.id ||
      !paymentMatchesOrder(result, o.id, result.id) ||
      !paymentMatchesTotal(result, o.total_cents)
    )
      throw new HttpError("Payment order mismatch", 409);
    const { error: save } = await service.rpc("attach_verified_paypal_order", {
      customer_id: user.id,
      order_id: o.id,
      paypal_id: result.id,
    });
    if (save)
      throw new DatabaseOperationError(save, "attach_verified_paypal_order");
    const link = result.links?.find((l: { rel: string; href: string }) =>
      ["approve", "payer-action"].includes(l.rel),
    );
    const approval = link ? new URL(link.href) : null;
    if (
      !approval ||
      approval.protocol !== "https:" ||
      approval.username ||
      approval.password ||
      !approval.hostname.endsWith(".paypal.com")
    )
      throw Error("Approval link unavailable");
    return Response.json({ approvalUrl: link.href });
  } catch (e) {
    return failure(e);
  }
}
