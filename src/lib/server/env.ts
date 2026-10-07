import "server-only";
import { z } from "zod";
import { HttpError } from "./errors";
export function supabaseConfig() {
  const parsed = z.object({ url: z.url(), key: z.string().min(1) }).safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success)
    throw new HttpError("Supabase configuration is incomplete", 503);
  return parsed.data;
}
export function paypalConfig() {
  const parsed = z
    .object({
      client: z.string().min(1),
      secret: z.string().min(1),
      webhook: z.string().min(1),
      app: z.url(),
    })
    .safeParse({
      client: process.env.PAYPAL_CLIENT_ID,
      secret: process.env.PAYPAL_CLIENT_SECRET,
      webhook: process.env.PAYPAL_WEBHOOK_ID,
      app: process.env.APP_URL,
    });
  if (!parsed.success)
    throw new HttpError("PayPal Sandbox is not configured", 503);
  return parsed.data;
}
export const configured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
