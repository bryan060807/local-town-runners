import "server-only";
import {
  sendApplicationEmail,
  uncertainDeliveryTooOld,
} from "../onboarding/email";
import { createHash } from "node:crypto";
import { authenticated, HttpError, serviceDb } from "./db";
import { consentPdf, ConsentPDF } from "../onboarding/pdf";
export const privateBucket = "onboarding-private";
export async function assertPrivateStorage() {
  const r = await serviceDb().storage.getBucket(privateBucket);
  if (r.error || r.data?.public !== false)
    throw new HttpError(
      "Private document storage is unavailable or misconfigured",
      503,
    );
}
export async function realUser(readonly = false) {
  const a = await authenticated(readonly);
  const check = await a.client.rpc("real_account");
  if (check.error || !check.data || a.profile.demo_workspace)
    throw new HttpError(
      "Real account required. Exit Demo Mode and sign in.",
      403,
    );
  return a;
}
export async function adminUser(readonly = false) {
  const a = await realUser(readonly);
  const check = await a.client.rpc("platform_admin");
  if (check.error || !check.data)
    throw new HttpError("Platform administrator required", 403);
  return a;
}
export async function generateDocument(id: string) {
  const c = serviceDb();
  const s = await c
    .from("agreement_submissions")
    .select("*")
    .eq("id", id)
    .single();
  if (s.error) throw Error("Consent unavailable");
  const d = await c
    .from("agreement_documents")
    .select("*")
    .eq("submission_id", id)
    .single();
  if (d.error) throw Error("Document record unavailable");
  if (d.data.path) return { ready: true };
  const application = s.data.application_id
    ? (
        await c
          .from("role_applications")
          .select("payload")
          .eq("id", s.data.application_id)
          .single()
      ).data?.payload
    : undefined;
  try {
    await assertPrivateStorage();
    const bytes = await consentPdf({ ...s.data, application } as ConsentPDF);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const path = `agreements/${s.data.user_id}/${id}.pdf`;
    const upload = await c.storage
      .from(privateBucket)
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (upload.error) {
      const prior = await c.storage.from(privateBucket).download(path);
      if (prior.error) throw Error("Private storage unavailable");
      const old = Buffer.from(await prior.data.arrayBuffer());
      if (!old.subarray(0, 4).equals(Buffer.from("%PDF")))
        throw Error("Invalid stored PDF");
      const r = await c
        .from("agreement_documents")
        .update({
          path,
          sha256: createHash("sha256").update(old).digest("hex"),
          generated_at: new Date().toISOString(),
          error_code: null,
        })
        .eq("submission_id", id)
        .is("path", null);
      if (r.error) throw r.error;
    } else {
      const r = await c
        .from("agreement_documents")
        .update({
          path,
          sha256,
          generated_at: new Date().toISOString(),
          error_code: null,
        })
        .eq("submission_id", id)
        .is("path", null);
      if (r.error) throw r.error;
    }
    return { ready: true };
  } catch {
    await c
      .from("agreement_documents")
      .update({
        error_code: "PDF_OR_STORAGE_UNAVAILABLE",
        attempts: d.data.attempts + 1,
      })
      .eq("submission_id", id)
      .is("path", null);
    return { ready: false };
  }
}
export async function deliverNotification(
  id: string,
  manual = false,
  transport: typeof fetch = fetch,
) {
  const c = serviceDb();
  const claim = await c.rpc("claim_notification_v41", {
    delivery_id: id,
    manual,
  });
  if (claim.error) throw Error("Queue unavailable");
  const n = claim.data;
  if (!n?.id) return;
  const finish = async (
    status: string,
    error_code: string | null,
    provider_id?: string,
  ) => {
    const r = await c
      .from("notification_deliveries")
      .update({
        status,
        error_code,
        lease_until: null,
        available_at: new Date(
          Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(n.attempts, 6)),
        ).toISOString(),
        ...(provider_id
          ? {
              provider_id,
              accepted_at: new Date().toISOString(),
              provider_event: "accepted",
              provider_event_at: new Date().toISOString(),
            }
          : {}),
      })
      .eq("id", n.id);
    if (r.error) throw Error("Notification receipt could not be recorded");
    if (provider_id) {
      // A delivery webhook can arrive before the send response is persisted.
      const event = await c
        .from("notification_provider_events")
        .select("event_type,event_at")
        .eq("message_id", provider_id)
        .neq("event_type", "email.sent")
        .order("event_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (event.error) return; // Acceptance is already durable; delivery stays unconfirmed.
      if (event.data) {
        const states: Record<string, string> = {
          "email.sent": "accepted",
          "email.delivered": "delivered",
          "email.bounced": "bounced",
          "email.failed": "rejected",
          "email.complained": "complained",
          "email.delivery_delayed": "delayed",
        };
        await c
          .from("notification_deliveries")
          .update({
            provider_event: states[event.data.event_type],
            provider_event_at: event.data.event_at,
          })
          .eq("id", n.id)
          .eq("provider_event", "accepted");
      }
    }
  };
  if (!process.env.RESEND_API_KEY || !process.env.ONBOARDING_EMAIL_FROM) {
    await finish("blocked", "EMAIL_NOT_CONFIGURED");
    return;
  }
  // Resend deduplication expires after 24h. Never blindly retry an uncertain older delivery.
  if (
    n.first_provider_attempt_at &&
    uncertainDeliveryTooOld(n.first_provider_attempt_at, 2)
  ) {
    await finish("blocked", "PROVIDER_RECONCILIATION_REQUIRED");
    return;
  }
  try {
    const s = await c
      .from("agreement_submissions")
      .select("application_id,kind,typed_name,created_at")
      .eq("id", n.submission_id)
      .single();
    if (s.error) throw Error("Consent missing");
    const document = await c
      .from("agreement_documents")
      .select("path")
      .eq("submission_id", n.submission_id)
      .single();
    if (!document.data?.path) {
      await finish("failed", "PDF_PENDING");
      return;
    }
    const application = await c
      .from("role_applications")
      .select("payload,status")
      .eq("id", s.data.application_id)
      .single();
    if (application.error) throw Error("Application unavailable");
    const url = new URL("/admin/onboarding", process.env.APP_URL!);
    url.searchParams.set("q", s.data.application_id);
    const recipient = process.env.ONBOARDING_EMAIL_TO;
    if (recipient !== "aibrymusic@gmail.com") {
      await finish("blocked", "ADMIN_RECIPIENT_NOT_CONFIGURED");
      return;
    }
    const payload = n.email_payload ?? {
      from: process.env.ONBOARDING_EMAIL_FROM!,
      to: [recipient],
      subject: `Local Town Runners — New ${s.data.kind === "vendor" ? "Vendor" : "Runner"} Application`,
      text: `A new ${s.data.kind} application has been received.\nBusiness name: ${application.data.payload.name}\nApplicant name: ${s.data.typed_name}\nSubmitted: ${s.data.created_at}\nSubmission ID: ${n.submission_id}\nApplication status: ${application.data.status}\nReview and download the private completed PDF after administrator sign-in: ${url.toString()}`,
    };
    // Persist the exact provider body and first send boundary before network I/O.
    const prepared = await c
      .from("notification_deliveries")
      .update({
        email_payload: payload,
        first_provider_attempt_at:
          n.first_provider_attempt_at ?? new Date().toISOString(),
      })
      .eq("id", n.id);
    if (prepared.error) throw Error("Provider boundary unavailable");
    const receipt = await sendApplicationEmail(
      {
        id: n.id,
        kind: s.data.kind,
        applicationId: s.data.application_id,
        adminUrl: url.toString(),
        payload,
        apiKey: process.env.RESEND_API_KEY!,
        from: process.env.ONBOARDING_EMAIL_FROM!,
      },
      transport,
    );
    if (
      receipt.error &&
      [
        "PROVIDER_HTTP_400",
        "PROVIDER_HTTP_401",
        "PROVIDER_HTTP_403",
        "PROVIDER_HTTP_422",
        "PROVIDER_HTTP_429",
      ].includes(receipt.error)
    ) {
      // Explicit validation/auth/rate-limit rejection cannot have accepted this message.
      // Retain the frozen body/key, but safely allow a fresh provider retry window.
      const rejected = await c
        .from("notification_deliveries")
        .update({ first_provider_attempt_at: null })
        .eq("id", n.id);
      if (rejected.error) throw Error("Provider rejection receipt unavailable");
    }
    await finish(receipt.status, receipt.error, receipt.providerId);
  } catch {
    await finish("failed", "DELIVERY_UNCONFIRMED");
  }
}
export async function processSubmission(id: string, manual = false) {
  const pdf = await generateDocument(id);
  const n = await serviceDb()
    .from("notification_deliveries")
    .select("id,status")
    .eq("submission_id", id)
    .maybeSingle();
  if (n.error) throw Error("Queue read unavailable");
  if (n.data && pdf.ready) await deliverNotification(n.data.id, manual);
  const after = await serviceDb()
    .from("notification_deliveries")
    .select("status")
    .eq("submission_id", id)
    .maybeSingle();
  return {
    documentReady: pdf.ready,
    notification: after.data?.status ?? "not_required",
  };
}

export async function publishApprovedPhotos(applicationId: string) {
  const c = serviceDb();
  const app = await c
    .from("role_applications")
    .select("status,role,payload")
    .eq("id", applicationId)
    .single();
  if (app.error || app.data.status !== "approved" || app.data.role !== "vendor")
    return { photoPublication: "not_required" };
  const mappings = await c
    .from("application_publications")
    .select("listing_id,product_index")
    .eq("application_id", applicationId);
  if (mappings.error) return { photoPublication: "pending" };
  try {
    for (const row of mappings.data) {
      const product = app.data.payload.products[row.product_index];
      if (!product.photos.length) continue;
      const listing = await c
        .from("listings")
        .select("vendor_id")
        .eq("id", row.listing_id)
        .single();
      if (listing.error) throw Error("Approved listing missing");
      const urls: string[] = [];
      for (const id of product.photos) {
        const asset = await c
          .from("application_assets")
          .select("path")
          .eq("application_id", applicationId)
          .eq("id", id)
          .single();
        if (asset.error) throw Error("Approved photograph missing");
        const privateFile = await c.storage
          .from(privateBucket)
          .download(asset.data.path);
        if (privateFile.error) throw Error("Private photograph unavailable");
        const path = `vendor/${listing.data.vendor_id}/${id}.webp`;
        const upload = await c.storage
          .from("marketplace-assets")
          .upload(path, await privateFile.data.arrayBuffer(), {
            contentType: "image/webp",
            upsert: false,
          });
        if (upload.error) {
          const exists = await c.storage
            .from("marketplace-assets")
            .download(path);
          if (exists.error) throw Error("Publication pending");
        }
        urls.push(
          c.storage.from("marketplace-assets").getPublicUrl(path).data
            .publicUrl,
        );
      }
      const attached = await c
        .from("listings")
        .update({ photos: urls })
        .eq("id", row.listing_id);
      if (attached.error) throw Error("Photo attachment pending");
    }
    return { photoPublication: "ready" };
  } catch {
    return { photoPublication: "pending" };
  }
}

export async function createPresentation(id: string) {
  const c = serviceDb();
  const existing = await c
    .from("agreement_presentations")
    .select("path")
    .eq("submission_id", id)
    .maybeSingle();
  if (existing.error) throw Error("Presentation registry unavailable");
  if (existing.data) return;
  const s = await c
    .from("agreement_submissions")
    .select("*")
    .eq("id", id)
    .single();
  if (s.error) throw Error("Consent unavailable");
  const app = await c
    .from("role_applications")
    .select("payload")
    .eq("id", s.data.application_id)
    .single();
  if (app.error) throw Error("Application unavailable");
  await assertPrivateStorage();
  const path = `presentations/${id}/readable-v1.pdf`;
  let bytes = await consentPdf({
    ...s.data,
    application: app.data.payload,
    presentation: true,
  });
  const upload = await c.storage
    .from(privateBucket)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  if (upload.error) {
    const old = await c.storage.from(privateBucket).download(path);
    if (old.error) throw Error("Presentation storage unavailable");
    bytes = Buffer.from(await old.data.arrayBuffer());
    if (!bytes.subarray(0, 4).equals(Buffer.from("%PDF")))
      throw Error("Invalid presentation");
  }
  const saved = await c.from("agreement_presentations").upsert(
    {
      submission_id: id,
      format_version: "readable-v1",
      path,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
    { onConflict: "submission_id,format_version", ignoreDuplicates: true },
  );
  if (saved.error) throw Error("Presentation receipt unavailable");
}
