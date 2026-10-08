import { z } from "zod";
import {
  adminUser,
  processSubmission,
  publishApprovedPhotos,
} from "@/lib/server/onboarding";
import { body, sameOrigin, failure, limited } from "@/lib/server/http";
const input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("review"),
      applicationId: z.uuid(),
      decision: z.enum(["under_review", "approved", "rejected"]),
      notes: z.string().max(2000),
    })
    .strict(),
  z.object({ action: z.literal("retry"), submissionId: z.uuid() }).strict(),
  z
    .object({
      action: z.literal("suspend"),
      userId: z.uuid(),
      suspended: z.boolean(),
    })
    .strict(),
]);
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, input);
    const { client } = await adminUser();
    await limited(client, "onboarding_admin");
    if (p.action === "retry") {
      const processing = await processSubmission(p.submissionId);
      const s = await client
        .from("agreement_submissions")
        .select("application_id")
        .eq("id", p.submissionId)
        .single();
      return Response.json({
        ...processing,
        ...(s.data?.application_id
          ? await publishApprovedPhotos(s.data.application_id)
          : {}),
      });
    }
    const r =
      p.action === "review"
        ? await client.rpc("review_application", {
            application_id: p.applicationId,
            decision: p.decision,
            notes: p.notes,
          })
        : await client.rpc("moderate", {
            resource_type: "profile",
            resource_id: p.userId,
            disabled: p.suspended,
          });
    if (r.error) throw r.error;
    return Response.json({
      ok: true,
      ...(p.action === "review" && p.decision === "approved"
        ? await publishApprovedPhotos(p.applicationId)
        : {}),
    });
  } catch (e) {
    return failure(e);
  }
}
