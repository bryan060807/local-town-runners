import { z } from "zod";
import { db } from "@/lib/server/db";
import { body, sameOrigin, failure } from "@/lib/server/http";
const schema = z
  .object({
    email: z.email(),
    password: z.string().min(12).max(128),
    action: z.enum(["signin", "signup"]),
  })
  .strict();
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, schema);
    const client = await db();
    const result =
      p.action === "signin"
        ? await client.auth.signInWithPassword(p)
        : await client.auth.signUp({ email: p.email, password: p.password });
    if (result.error)
      return Response.json(
        { error: "Authentication failed. Check your details or try later." },
        { status: 400 },
      );
    return Response.json({
      ok: true,
      confirmationRequired: !result.data.session,
    });
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
