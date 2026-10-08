export type EmailResult = {
  status: "accepted" | "failed" | "blocked";
  error: string | null;
  providerId?: string;
};
export function notificationKey(id: string) {
  return `ltr-application-${id}`;
}
export function uncertainDeliveryTooOld(
  createdAt: string,
  attempts: number,
  now = Date.now(),
) {
  return attempts > 1 && now - Date.parse(createdAt) > 23 * 3600000;
}
export async function sendApplicationEmail(
  input: {
    id: string;
    kind: string;
    applicationId: string;
    adminUrl: string;
    apiKey: string;
    from: string;
    to?: string;
    businessName?: string;
    applicantName?: string;
    submittedAt?: string;
    submissionId?: string;
    applicationStatus?: string;
    payload?: { from: string; to: string[]; subject: string; text: string };
  },
  transport: typeof fetch = fetch,
): Promise<EmailResult> {
  try {
    const r = await transport("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": notificationKey(input.id),
      },
      body: JSON.stringify(
        input.payload
          ? {
              from: input.payload.from,
              to: input.payload.to,
              subject: input.payload.subject,
              text: input.payload.text,
            }
          : {
              from: input.from,
              to: [input.to ?? "aibrymusic@gmail.com"],
              subject: `Local Town Runners — New ${input.kind === "vendor" ? "Vendor" : "Runner"} Application`,
              text: `A new ${input.kind} application has been received.\nBusiness name: ${input.businessName ?? "See application"}\nApplicant name: ${input.applicantName ?? "See application"}\nSubmitted: ${input.submittedAt ?? "See application"}\nSubmission ID: ${input.submissionId ?? input.id}\nApplication status: ${input.applicationStatus ?? "submitted"}\nReview and download the private completed PDF after administrator sign-in: ${input.adminUrl}`,
            },
      ),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      return {
        status: [400, 401, 403, 409, 422].includes(r.status)
          ? "blocked"
          : "failed",
        error: `PROVIDER_HTTP_${r.status}`,
      };
    const receipt = await r.json();
    if (
      typeof receipt.id !== "string" ||
      receipt.id.length > 128 ||
      !receipt.id
    )
      return { status: "failed", error: "INVALID_PROVIDER_RECEIPT" };
    return { status: "accepted", error: null, providerId: receipt.id };
  } catch {
    return { status: "failed", error: "DELIVERY_UNCONFIRMED" };
  }
}
