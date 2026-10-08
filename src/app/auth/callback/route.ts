import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
export async function GET(req: Request) {
  const u = new URL(req.url),
    code = u.searchParams.get("code");
  if (code && code.length < 2048) {
    const c = await db();
    const r = await c.auth.exchangeCodeForSession(code);
    if (!r.error)
      return NextResponse.redirect(
        new URL(
          u.searchParams.get("recovery") === "1" ? "/recovery" : "/account",
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
