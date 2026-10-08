import { timingSafeEqual } from "node:crypto";
import { processSubmission } from "@/lib/server/onboarding";
import { serviceDb } from "@/lib/server/db";
export const maxDuration = 300;
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.get("authorization") ?? "";
  if (
    !expected ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(`Bearer ${expected}`) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(`Bearer ${expected}`))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const c = serviceDb();
  const jobs = await c
    .from("notification_deliveries")
    .select("submission_id")
    .eq("auto_dispatch", true)
    .in("status", ["queued", "failed", "sending"])
    .lt("attempts", 5)
    .lte("available_at", new Date().toISOString())
    .order("available_at")
    .limit(5);
  if (jobs.error)
    return Response.json({ error: "Queue unavailable" }, { status: 503 });
  let processed = 0;
  for (const job of jobs.data) {
    try {
      await processSubmission(job.submission_id);
      processed++;
    } catch {
      /* Persistent job remains available for next trusted attempt. */
    }
  }
  return Response.json(
    { processed },
    { headers: { "Cache-Control": "no-store" } },
  );
}
