// Local PostgreSQL/Auth queue integration. Provider transport is injected; no remote mail.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { deliverNotification } from "../src/lib/server/onboarding";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.startsWith("http://127.0.0.1:")) throw Error("Local-only test");
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const user = createClient(
  url,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
);
const email = `queue-${randomUUID()}@local-town-runners.example`,
  password = randomBytes(20).toString("base64url");
const created = await service.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
assert.equal(created.error, null);
assert.equal(
  (await user.auth.signInWithPassword({ email, password })).error,
  null,
);
const payload = {
  name: "LOCAL QUEUE fixture",
  representative: "LOCAL QUEUE signer",
  phone: "000 TEST",
  serviceArea: "Fictional area",
  description: "No actual vendor",
  category: "Food",
  businessInfo: "",
  products: [
    {
      title: "Local fixture",
      description: "Unit only",
      mode: "SELL",
      priceCents: 450,
      inventory: 1,
      availability: "Test",
      photos: [],
    },
  ],
};
const draft = await user.rpc("save_application", {
  application_role: "vendor",
  application_payload: payload,
});
if (draft.error) throw Error("Draft fixture failed: " + draft.error.code);
const version = await service
  .from("agreement_versions")
  .select("id,sections")
  .eq("kind", "vendor")
  .eq("active", true)
  .single();
assert.equal(version.error, null);
const submitted = await user.rpc("submit_application", {
  application_id: draft.data,
  agreement_id: version.data.id,
  typed_name: "LOCAL QUEUE signer",
  signature: [
    [
      [10, 10],
      [30, 40],
    ],
  ],
  acknowledgments: version.data.sections,
});
if (submitted.error)
  throw Error("Submission fixture failed: " + submitted.error.code);
const id = submitted.data;
await service
  .from("agreement_documents")
  .update({ path: `LOCAL-FIXTURE/${id}.pdf`, sha256: "a".repeat(64) })
  .eq("submission_id", id);
const job = await service
  .from("notification_deliveries")
  .select("id")
  .eq("submission_id", id)
  .single();
assert.equal(job.error, null);
process.env.RESEND_API_KEY = "LOCAL MOCK ONLY";
process.env.ONBOARDING_EMAIL_FROM = "Local <unit@example.invalid>";
process.env.ONBOARDING_EMAIL_TO = "aibrymusic@gmail.com";
let calls = 0;
const bodies: string[] = [],
  keys: string[] = [];
const transport = (async (_url: unknown, init: RequestInit) => {
  calls++;
  bodies.push(String(init.body));
  keys.push(new Headers(init.headers).get("Idempotency-Key")!);
  if (calls === 1)
    return Response.json({ error: "local temporary failure" }, { status: 503 });
  const event = await service.rpc("record_notification_event", {
    event_id: "LOCAL-EVENT-" + id,
    message_id: "LOCAL-RECEIPT-" + id,
    event_type: "email.delivered",
    event_at: new Date().toISOString(),
  });
  assert.equal(event.error, null);
  return Response.json({ id: "LOCAL-RECEIPT-" + id });
}) as typeof fetch;
await deliverNotification(job.data.id, true, transport);
const failed = await service
  .from("notification_deliveries")
  .select("job_status,error_code")
  .eq("id", job.data.id)
  .single();
assert.equal(failed.data?.job_status, "retrying");
assert.equal(failed.data?.error_code, "PROVIDER_HTTP_503");
await deliverNotification(job.data.id, true, transport);
await deliverNotification(job.data.id, true, transport);
const sent = await service
  .from("notification_deliveries")
  .select("job_status,provider_event,attempts")
  .eq("id", job.data.id)
  .single();
assert.equal(sent.data?.job_status, "sent");
assert.equal(sent.data?.provider_event, "delivered");
assert.equal(calls, 2);
assert.equal(bodies[0], bodies[1]);
assert.equal(keys[0], keys[1]);
assert.deepEqual(JSON.parse(bodies[0]).to, ["aibrymusic@gmail.com"]);
const count = await service
  .from("agreement_submissions")
  .select("id", { count: "exact", head: true })
  .eq("id", id);
assert.equal(count.count, 1);
// Reproduce a specific P0001 safely against this local fixture only.
const immutableDraft = await user.rpc("save_application", {
  application_role: "vendor",
  application_payload: payload,
});
assert.equal(immutableDraft.error?.code, "P0001");
assert.equal(
  immutableDraft.error?.message,
  "Submitted applications are immutable",
);
console.log(
  "Local P0001 reproduction passed: save_application rejects editing an already submitted application; no production request or payment mutation.",
);
console.log(
  "Local queue integration passed: temporary failure persisted, frozen retry accepted, early delivery event reconciled, third send refused, one consent retained. No remote email sent.",
);
