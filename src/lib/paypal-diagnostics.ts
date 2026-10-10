import { createHash } from "node:crypto";
export function credentialCheck(value: string | undefined) {
  return {
    present: !!value,
    outerWhitespace: !!value && value.trim() !== value,
    containsWhitespace: !!value && /\s/.test(value),
    wrappedInQuotes: !!value && /^["']|["']$/.test(value),
    looksLikeAssignment: !!value && /^PAYPAL_[A-Z_]+\s*=/.test(value),
  };
}
export async function sandboxAuthCheck(
  client: string | undefined,
  secret: string | undefined,
  transport: typeof fetch = fetch,
) {
  const checks = {
    clientId: credentialCheck(client),
    clientSecret: credentialCheck(secret),
  };
  const clientIdFingerprint = client
    ? createHash("sha256").update(client).digest("hex")
    : null;
  if (!client || !secret)
    return { checks, clientIdFingerprint, outcome: "missing_configuration" };
  try {
    const r = await transport(
      "https://api-m.sandbox.paypal.com/v1/oauth2/token",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " + Buffer.from(`${client}:${secret}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    const json = await r.json();
    const errorCode = [
      "invalid_client",
      "invalid_request",
      "unauthorized_client",
      "unsupported_grant_type",
      "invalid_scope",
    ].includes(json.error)
      ? json.error
      : undefined;
    const debug = r.headers.get("paypal-debug-id");
    return {
      checks,
      clientIdFingerprint,
      httpStatus: r.status,
      outcome:
        r.ok && typeof json.access_token === "string" && !!json.access_token
          ? "authenticated"
          : "rejected",
      errorCode,
      debugId:
        debug && /^[A-Za-z0-9_-]{1,128}$/.test(debug) ? debug : undefined,
    };
  } catch {
    return {
      checks,
      clientIdFingerprint,
      outcome: "network_or_invalid_response",
    };
  }
}
