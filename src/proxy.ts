import { createServerClient } from "@supabase/ssr";
import { NextResponse, NextRequest } from "next/server";
export async function proxy(req: NextRequest) {
  let response = NextResponse.next({ request: req });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_URL?.startsWith("https://") || false,
      path: "/",
    },
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => req.cookies.set(name, value));
        response = NextResponse.next({ request: req });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await client.auth.getUser();
  return response;
}
export const config = { matcher: ["/dashboard/:path*", "/api/:path*"] };
