import { z } from "zod";
import { realUser } from "@/lib/server/onboarding";
import { body, failure, sameOrigin, limited } from "@/lib/server/http";
const input = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("profile"),
      name: z.string().trim().min(2).max(150),
      communication: z.enum(["essential", "email"]),
      analytics: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("address"),
      label: z.string().min(1).max(60),
      address: z.string().min(8).max(500),
      instructions: z.string().max(500),
    })
    .strict(),
  z.object({ action: z.literal("removeAddress"), id: z.uuid() }).strict(),
  z
    .object({
      action: z.literal("delete"),
      confirm: z.literal("REQUEST DELETION"),
    })
    .strict(),
]);
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, input);
    const { client, user } = await realUser();
    await limited(client, "account");
    if (p.action === "profile") {
      const a = await client
        .from("profiles")
        .update({ display_name: p.name })
        .eq("id", user.id);
      if (a.error) throw a.error;
      const r = await client
        .from("account_privacy")
        .upsert({
          user_id: user.id,
          communication: p.communication,
          analytics_consent: p.analytics,
        });
      if (r.error) throw r.error;
    } else if (p.action === "address") {
      const r = await client
        .from("private_addresses")
        .insert({
          user_id: user.id,
          label: p.label,
          address: p.address,
          instructions: p.instructions,
        });
      if (r.error) throw r.error;
    } else if (p.action === "removeAddress") {
      const r = await client
        .from("private_addresses")
        .delete()
        .eq("id", p.id)
        .eq("user_id", user.id);
      if (r.error) throw r.error;
    } else {
      const r = await client.rpc("request_account_deletion");
      if (r.error) throw r.error;
      await client.auth.signOut();
    }
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
