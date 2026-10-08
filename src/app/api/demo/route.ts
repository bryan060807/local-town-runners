import { z } from "zod";
import { cookies } from "next/headers";
import { body, failure, sameOrigin } from "@/lib/server/http";
import { db, serviceDb } from "@/lib/server/db";
import {
  demoEnabled,
  demoSession,
  enterDemo,
  demoCookie,
} from "@/lib/server/demo";
import { demoNames, demoRoles } from "@/lib/demo-catalog";
export async function GET() {
  try {
    const enabled = await demoEnabled();
    if (!enabled)
      return Response.json(
        { enabled: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    const session = await demoSession();
    const client = await db(true);
    const {
      data: { user },
    } = await client.auth.getUser();
    const role = session
      ? demoRoles.find((r) => session[`${r}_id`] === user?.id)
      : undefined;
    return Response.json(
      {
        enabled,
        active: Boolean(role),
        role,
        name: role ? demoNames[role] : undefined,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const p = await body(req, z.object({ role: z.enum(demoRoles) }).strict());
    return Response.json(await enterDemo(req, p.role));
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const client = await db();
    const session = await demoSession();
    if (session) {
      const { error } = await serviceDb()
        .from("demo_sessions")
        .update({ expires_at: new Date().toISOString() })
        .eq("token_hash", session.token_hash);
      if (error) throw error;
    }
    const { error } = await client.auth.signOut();
    if (error) throw error;
    (await cookies()).delete(demoCookie);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
