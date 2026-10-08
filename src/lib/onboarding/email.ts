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
      body: JSON.stringify({
        from: input.from,
        to: ["aibrymusic@gmail.com"],
        subject: `LTR ${input.kind} application submitted`,
        text: `Application ${input.applicationId}\nConsent saved; completed PDF is available only after administrator sign-in.\nReview securely: ${input.adminUrl}\nNo applicant contact details or signature are included in this email.`,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return { status: "failed", error: `PROVIDER_HTTP_${r.status}` };
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
