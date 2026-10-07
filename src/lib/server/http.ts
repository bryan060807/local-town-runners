import "server-only";
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
  if (e instanceof HttpError)
    return Response.json({ error: e.message }, { status: e.status });
  if (e instanceof z.ZodError || e instanceof SyntaxError)
    return Response.json({ error: "Invalid request" }, { status: 400 });
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
