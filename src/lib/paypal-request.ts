import { logEvent, ProviderError } from "./observability";

const base = "https://api-m.sandbox.paypal.com";

async function providerFetch(
  stage: string,
  url: string,
  options: RequestInit,
  transport: typeof fetch,
) {
  try {
    // Credentialed API calls must not follow an upstream redirect to another host.
    return await transport(url, { ...options, redirect: "error" });
  } catch {
    logEvent("payment_failure", { stage, outcome: "network_or_timeout" });
    throw new ProviderError("paypal", stage);
  }
}

async function providerJson(response: Response, stage: string) {
  try {
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error("Invalid provider response");
    return value as Record<string, unknown>;
  } catch {
    logEvent("payment_failure", { stage, outcome: "invalid_response" });
    throw new ProviderError("paypal", stage, response.status);
  }
}

/** Fixed Sandbox transport; the injected transport is used only by local tests. */
export async function sandboxPayPalRequest(
  credentials: { client: string; secret: string },
  path: string,
  body?: unknown,
  key?: string,
  transport: typeof fetch = fetch,
) {
  let endpoint: URL;
  try {
    endpoint = new URL(path, base);
    if (
      !path.startsWith("/") ||
      endpoint.origin !== base ||
      endpoint.username ||
      endpoint.password ||
      endpoint.hash ||
      !/^\/v[12]\//.test(endpoint.pathname)
    )
      throw Error("Invalid Sandbox API path");
  } catch {
    throw new ProviderError("paypal", "request_path");
  }
  const tokenResponse = await providerFetch(
    "oauth",
    `${base}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.client}:${credentials.secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
    transport,
  );
  if (!tokenResponse.ok) {
    logEvent("payment_failure", {
      stage: "oauth",
      status: tokenResponse.status,
    });
    throw new ProviderError("paypal", "oauth", tokenResponse.status);
  }
  const token = await providerJson(tokenResponse, "oauth_response");
  if (typeof token.access_token !== "string" || !token.access_token.trim()) {
    logEvent("payment_failure", {
      stage: "oauth_response",
      outcome: "invalid_token",
    });
    throw new ProviderError("paypal", "oauth_response", tokenResponse.status);
  }
  const response = await providerFetch(
    "request",
    endpoint.href,
    {
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
    },
    transport,
  );
  if (!response.ok) {
    logEvent("payment_failure", {
      stage: path.includes("verify-webhook")
        ? "webhook_verification"
        : path.endsWith("/capture")
          ? "capture"
          : "order",
      status: response.status,
    });
    throw new ProviderError("paypal", "request", response.status);
  }
  return await providerJson(response, "response");
}
