import "server-only";
import { logEvent, ProviderError } from "@/lib/observability";
import { readLimited } from "@/lib/request-body";
import { HttpError } from "./db";
import { z } from "zod";
export function sameOrigin(req: Request) {
  const expected = process.env.APP_URL;
  if (!expected) throw new HttpError("Application URL is not configured", 503);
  if (req.headers.get("origin") !== new URL(expected).origin)
    throw new HttpError("Invalid request origin", 403);
}
export async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const text = await readLimited(req);
  return schema.parse(JSON.parse(text));
}
export function failure(e: unknown) {
  if (e instanceof HttpError) {
    logEvent("request_rejected", { status: e.status });
    return Response.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof ProviderError) {
    logEvent("provider_failure", { stage: e.stage, status: e.status });
    return Response.json(
      {
        error:
          e.provider === "paypal" && e.stage === "oauth"
            ? "PayPal Sandbox authentication failed. Check the server Sandbox credentials."
            : "External service unavailable. Please retry.",
      },
      { status: 503 },
    );
  }
  if (e instanceof z.ZodError || e instanceof SyntaxError)
    return Response.json({ error: "Invalid request" }, { status: 400 });
  const code =
    e &&
    typeof e === "object" &&
    "code" in e &&
    typeof e.code === "string" &&
    /^[A-Z0-9]{4,12}$/.test(e.code)
      ? e.code
      : undefined;
  if (code) {
    logEvent("database_failure", { code });
    if (code === "42501")
      return Response.json(
        { error: "You do not have permission for this action." },
        { status: 403 },
      );
    if (code === "P0001" || code === "23505")
      return Response.json(
        {
          error:
            "This action is unavailable in the current state. Refresh and review the order.",
        },
        { status: 409 },
      );
  }
  console.error(
    JSON.stringify({
      event: "request_failed",
      kind: e instanceof Error ? e.name : "unknown",
    }),
  );
  return Response.json(
    {
      error: "Operation unavailable. Check server configuration and try again.",
    },
    { status: 503 },
  );
}
export async function limited(
  client: Awaited<ReturnType<typeof import("./db").db>>,
  action: string,
) {
  const { error } = await client.rpc("consume_rate_limit", {
    action_name: action,
  });
  if (error)
    throw new HttpError(
      "Too many requests or rate-limit service unavailable",
      429,
    );
}
