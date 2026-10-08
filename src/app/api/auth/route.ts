import { z } from "zod";
import { createHmac } from "node:crypto";
import { db, serviceDb, HttpError } from "@/lib/server/db";
import { body, sameOrigin, failure } from "@/lib/server/http";
const credentials = {
  email: z.email().max(254),
  password: z.string().min(12).max(128),
};
const schema = z.discriminatedUnion("action", [
  z.object({ ...credentials, action: z.enum(["signin", "signup"]) }).strict(),
  z
    .object({
      email: z.email().max(254),
      action: z.enum(["recover", "resend"]),
    })
    .strict(),
  z
    .object({ action: z.literal("password"), password: credentials.password })
    .strict(),
]);
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, schema);
    const c = await db();
    if (p.action === "password") {
      const user = await c.auth.getUser();
      if (!user.data.user)
        throw new HttpError("Open your recovery email link first", 401);
      const r = await c.auth.updateUser({ password: p.password });
      if (r.error) throw new HttpError("Password update failed", 400);
      return Response.json({ ok: true });
    }
    // Service-backed, hashed source limits; no emails or IP addresses in audit logs.
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const key = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY)
        .update(
          "auth:" +
            (req.headers.get("x-vercel-forwarded-for") ||
              req.headers.get("x-forwarded-for")?.split(",")[0] ||
              "local"),
        )
        .digest("hex");
      const r = await serviceDb().rpc("consume_auth_entry", { key_hash: key });
      if (r.error)
        throw new HttpError(
          "Too many authentication attempts. Try later.",
          429,
        );
    }
    if (p.action === "recover") {
      await c.auth.resetPasswordForEmail(p.email, {
        redirectTo: new URL(
          "/auth/callback?recovery=1",
          process.env.APP_URL!,
        ).toString(),
      });
      return Response.json({
        ok: true,
        message: "If this account can receive mail, check your inbox.",
      });
    }
    if (p.action === "resend") {
      await c.auth.resend({
        type: "signup",
        email: p.email,
        options: {
          emailRedirectTo: new URL(
            "/auth/callback",
            process.env.APP_URL!,
          ).toString(),
        },
      });
      return Response.json({
        ok: true,
        message: "If eligible, a verification email has been requested.",
      });
    }
    if (!("password" in p)) throw new HttpError("Invalid authentication action", 400);
    const r =
      p.action === "signin"
        ? await c.auth.signInWithPassword({
            email: p.email,
            password: p.password,
          })
        : await c.auth.signUp({
            email: p.email,
            password: p.password,
            options: {
              emailRedirectTo: new URL(
                "/auth/callback",
                process.env.APP_URL!,
              ).toString(),
            },
          });
    if (r.error)
      return Response.json(
        { error: "Authentication failed. Check your details or try later." },
        { status: 400 },
      );
    return Response.json({ ok: true, confirmationRequired: !r.data.session });
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const c = await db();
    const { error } = await c.auth.signOut();
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
