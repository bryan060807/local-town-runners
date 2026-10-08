import { z } from "zod";
import { realUser, processSubmission } from "@/lib/server/onboarding";
import { sameOrigin, failure, limited } from "@/lib/server/http";
import { readLimited } from "@/lib/request-body";
import {
  vendorPayload,
  runnerPayload,
  signatureSchema,
} from "@/lib/onboarding/schema";
const input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("draft"),
      role: z.enum(["vendor", "runner"]),
      payload: z.unknown(),
    })
    .strict(),
  z
    .object({
      action: z.literal("submit"),
      applicationId: z.uuid(),
      agreementId: z.uuid(),
      typedName: z.string().trim().min(2).max(150),
      signature: signatureSchema,
      acknowledged: z.literal(true),
      consent: z.literal(true),
    })
    .strict(),
  z
    .object({
      action: z.literal("customer"),
      agreementId: z.uuid(),
      typedName: z.string().trim().min(2).max(150),
      consent: z.literal(true),
    })
    .strict(),
  z
    .object({ action: z.literal("retryDocument"), submissionId: z.uuid() })
    .strict(),
]);
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = input.parse(JSON.parse(await readLimited(req, 64000)));
    const { client, user } = await realUser();
    await limited(client, "onboarding");
    if (p.action === "draft") {
      const payload =
        p.role === "vendor"
          ? vendorPayload.parse(p.payload)
          : runnerPayload.parse(p.payload);
      const r = await client.rpc("save_application", {
        application_role: p.role,
        application_payload: payload,
      });
      if (r.error) throw r.error;
      return Response.json({ applicationId: r.data });
    }
    let submissionId: string;
    if (p.action === "submit") {
      const app = await client
        .from("role_applications")
        .select("*")
        .eq("id", p.applicationId)
        .eq("user_id", user.id)
        .single();
      if (app.error) throw Error("Application unavailable");
      if (app.data.role === "vendor") vendorPayload.parse(app.data.payload);
      else runnerPayload.parse(app.data.payload);
      const a = await client
        .from("agreement_versions")
        .select("sections")
        .eq("id", p.agreementId)
        .eq("active", true)
        .single();
      if (a.error) throw Error("Current agreement unavailable");
      if (app.data.role === "vendor") {
        for (const product of vendorPayload.parse(app.data.payload).products)
          for (const id of product.photos) {
            const asset = await client
              .from("application_assets")
              .select("id")
              .eq("id", id)
              .eq("application_id", p.applicationId)
              .single();
            if (asset.error) throw Error("Product photograph unavailable");
          }
      }
      const r = await client.rpc("submit_application", {
        application_id: p.applicationId,
        agreement_id: p.agreementId,
        typed_name: p.typedName,
        signature: p.signature,
        acknowledgments: a.data.sections,
      });
      if (r.error) throw r.error;
      submissionId = r.data;
    } else if (p.action === "customer") {
      const r = await client.rpc("accept_customer_terms", {
        agreement_id: p.agreementId,
        typed_name: p.typedName,
      });
      if (r.error) throw r.error;
      submissionId = r.data;
    } else {
      const s = await client
        .from("agreement_submissions")
        .select("id")
        .eq("id", p.submissionId)
        .eq("user_id", user.id)
        .single();
      if (s.error) throw Error("Consent unavailable");
      submissionId = p.submissionId;
    }
    let processing;
    try {
      processing = await processSubmission(submissionId);
    } catch {
      processing = { documentReady: false, notification: "processing_pending" };
    }
    return Response.json({ submissionId, saved: true, ...processing });
  } catch (e) {
    return failure(e);
  }
}
