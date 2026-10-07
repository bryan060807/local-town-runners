import "server-only";
import { validWebhookCertificate } from "@/lib/payment-validation";
export { validCapture } from "@/lib/payment-validation";
import { paypalConfig } from "./env";
const base = "https://api-m.sandbox.paypal.com";
export async function paypal(path: string, body?: unknown, key?: string) {
  const e = paypalConfig();
  const t = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${e.client}:${e.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!t.ok) throw Error("PayPal authentication unavailable");
  const token = await t.json();
  const r = await fetch(`${base}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(key ? { "PayPal-Request-Id": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const data = await r.json();
  if (!r.ok) throw Error(`PayPal request failed (${r.status})`);
  return data;
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
  const cert = new URL(headers.get("paypal-cert-url")!);
  if (!validWebhookCertificate(cert.toString())) return false;
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
