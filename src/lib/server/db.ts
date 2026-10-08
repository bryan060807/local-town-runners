import "server-only";
import { HttpError } from "./errors";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabaseConfig } from "./env";
export async function db(readonlyCookies = false) {
  const c = await cookies();
  const e = supabaseConfig();
  return createServerClient(e.url, e.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_URL?.startsWith("https://") || false,
      path: "/",
    },
    cookies: {
      getAll: () => c.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values)
            c.set(name, value, options);
        } catch (e) {
          if (!readonlyCookies) throw e;
        }
      },
    },
  });
}
export function serviceDb() {
  const e = supabaseConfig();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error("Server database credentials missing");
  return createClient(e.url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function authenticated(readonlyCookies = false) {
  const client = await db(readonlyCookies);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError("Sign in required", 401);
  const { data: profile, error: pe } = await client
    .from("profiles")
    .select("id,display_name,suspended,demo_workspace")
    .eq("id", data.user.id)
    .single();
  if (pe || !profile || profile.suspended)
    throw new HttpError("Account unavailable", 403);
  return { client, user: data.user, profile };
}
export { HttpError } from "./errors";
