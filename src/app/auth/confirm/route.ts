import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
export async function GET(req: Request) {
  const u = new URL(req.url);
  const type = z
    .enum(["signup", "recovery", "email_change"])
    .safeParse(u.searchParams.get("type"));
  const hash = u.searchParams.get("token_hash");
  if (type.success && hash && hash.length < 512) {
    const c = await db();
    const r = await c.auth.verifyOtp({ token_hash: hash, type: type.data });
    if (!r.error)
      return NextResponse.redirect(
        new URL(
          type.data === "recovery" ? "/recovery" : "/account",
          process.env.APP_URL || u.origin,
        ),
      );
  }
  return NextResponse.redirect(
    new URL(
      "/login?notice=verification_failed",
      process.env.APP_URL || u.origin,
    ),
  );
}
