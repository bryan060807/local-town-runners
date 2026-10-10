import "server-only";
import { logEvent, ProviderError } from "@/lib/observability";
import { validWebhookCertificate } from "@/lib/payment-validation";
export { validCapture } from "@/lib/payment-validation";
import { paypalConfig } from "./env";
const base = "https://api-m.sandbox.paypal.com";
async function providerFetch(stage: string, url: string, options: RequestInit) {
  try {
    return await fetch(url, options);
  } catch {
    logEvent("payment_failure", { stage, outcome: "network_or_timeout" });
    throw new ProviderError("paypal", stage);
  }
}
export async function paypal(path: string, body?: unknown, key?: string) {
  const e = paypalConfig();
  const t = await providerFetch("oauth", `${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${e.client}:${e.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!t.ok) {
    logEvent("payment_failure", { stage: "oauth", status: t.status });
    throw new ProviderError("paypal", "oauth", t.status);
  }
  const token = await t.json();
  const r = await providerFetch("request", `${base}${path}`, {
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
  if (!r.ok) {
    logEvent("payment_failure", {
      stage: path.includes("verify-webhook")
        ? "webhook_verification"
        : path.endsWith("/capture")
          ? "capture"
          : "order",
      status: r.status,
    });
    throw new ProviderError("paypal", "request", r.status);
  }
  return await r.json();
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
