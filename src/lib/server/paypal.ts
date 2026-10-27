import "server-only";
import { validWebhookCertificate } from "@/lib/payment-validation";
import { sandboxPayPalRequest } from "@/lib/paypal-request";
export { validCapture } from "@/lib/payment-validation";
import { paypalConfig } from "./env";
export async function paypal(path: string, body?: unknown, key?: string) {
  return sandboxPayPalRequest(paypalConfig(), path, body, key);
}
export async function verifyWebhook(headers: Headers, event: unknown) {
  const required = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ];
  if (required.some((h) => !headers.get(h))) return false;
  const certificate = headers.get("paypal-cert-url")!;
  if (!validWebhookCertificate(certificate)) return false;
  const cert = new URL(certificate);
  const result = await paypal("/v1/notifications/verify-webhook-signature", {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: cert.toString(),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: paypalConfig().webhook,
    webhook_event: event,
  });
  return result.verification_status === "SUCCESS";
}
