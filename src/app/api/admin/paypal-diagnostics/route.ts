import { adminUser } from "@/lib/server/onboarding";
import { sameOrigin, failure, limited } from "@/lib/server/http";
import { sandboxAuthCheck } from "@/lib/paypal-diagnostics";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { client } = await adminUser();
    await limited(client, "onboarding_admin");
    const report = await sandboxAuthCheck(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET,
    );
    return Response.json(report, {
      headers: {
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
