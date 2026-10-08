import { z } from "zod";
import { verifyEmailWebhook } from "@/lib/onboarding/webhook";
import { serviceDb } from "@/lib/server/db";
const event = z.object({
  type: z.enum([
    "email.sent",
    "email.delivered",
    "email.bounced",
    "email.failed",
    "email.complained",
    "email.delivery_delayed",
  ]),
  created_at: z.iso.datetime({ offset: true }),
  data: z.object({ email_id: z.string().min(1).max(128) }),
});
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret)
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  const reader = req.body?.getReader();
  if (!reader) return new Response(null, { status: 400 });
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.length;
    if (size > 65536) {
      await reader.cancel();
      return new Response(null, { status: 413 });
    }
    parts.push(chunk.value);
  }
  const raw = Buffer.concat(parts).toString("utf8");
  if (!verifyEmailWebhook(raw, req.headers, secret))
    return new Response(null, { status: 401 });
  let parsed;
  try {
    parsed = event.safeParse(JSON.parse(raw));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed.success) return Response.json({ ignored: true });
  const result = await serviceDb().rpc("record_notification_event", {
    event_id: req.headers.get("svix-id"),
    message_id: parsed.data.data.email_id,
    event_type: parsed.data.type,
    event_at: parsed.data.created_at,
  });
  if (result.error)
    return Response.json(
      { error: "Event persistence unavailable" },
      { status: 503 },
    );
  return Response.json({ ok: true });
}
