import "server-only";
import { cookies } from "next/headers";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { db, serviceDb, HttpError } from "./db";
import { provisionDemo, DemoCredentials } from "../demo-provision";
import {
  demoTokenHash,
  sealDemoCredentials,
  openDemoCredentials,
} from "../demo-crypto";
import { DemoRole } from "../demo-catalog";
export const demoCookie = "ltr_demo_ticket";
export async function demoEnabled() {
  if (
    process.env.DEMO_MODE_ENABLED === "false" ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  )
    return false;
  const { data, error } = await serviceDb().rpc("demo_mode_enabled");
  if (error) return false;
  return data === true;
}
export async function demoSession() {
  const token = (await cookies()).get(demoCookie)?.value;
  if (!token || token.length > 100) return null;
  const { data, error } = await serviceDb()
    .from("demo_sessions")
    .select("*")
    .eq("token_hash", demoTokenHash(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return data;
}
export async function enterDemo(req: Request, role: DemoRole) {
  if (!(await demoEnabled()))
    throw new HttpError("Demo Mode is disabled or not configured", 503);
  const service = serviceDb();
  let session = await demoSession();
  let credentials: DemoCredentials;
  if (session)
    credentials = openDemoCredentials(
      session.credentials,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    ) as DemoCredentials;
  else {
    const key = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!)
      .update(
        req.headers.get("x-vercel-forwarded-for") ||
          req.headers.get("x-forwarded-for")?.split(",")[0] ||
          "local",
      )
      .digest("hex");
    const { error } = await service.rpc("consume_demo_entry", {
      key_hash: key,
    });
    if (error)
      throw new HttpError("Too many new demos. Please try later.", 429);
    const workspace = randomUUID();
    credentials = await provisionDemo(service, workspace);
    const token = randomBytes(32).toString("base64url"),
      expires = new Date(Date.now() + 6 * 3600000);
    const { error: save } = await service.from("demo_sessions").insert({
      token_hash: demoTokenHash(token),
      workspace_id: workspace,
      credentials: sealDemoCredentials(
        credentials,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      ),
      customer_id: credentials.customer.id,
      vendor_id: credentials.vendor.id,
      runner_id: credentials.runner.id,
      expires_at: expires.toISOString(),
    });
    if (save) throw save;
    (await cookies()).set(demoCookie, token, {
      httpOnly: true,
      secure: process.env.APP_URL?.startsWith("https://") || false,
      sameSite: "lax",
      path: "/",
      expires,
    });
    session = {
      workspace_id: workspace,
      customer_id: credentials.customer.id,
      vendor_id: credentials.vendor.id,
      runner_id: credentials.runner.id,
    };
  }
  const target = credentials[role];
  const { data: profile, error: check } = await service
    .from("profiles")
    .select("demo_workspace,suspended")
    .eq("id", target.id)
    .single();
  if (
    check ||
    profile.suspended ||
    profile.demo_workspace !== session.workspace_id ||
    target.id !== session[`${role}_id`]
  )
    throw new HttpError("Invalid demo identity", 403);
  const client = await db();
  const result = await client.auth.signInWithPassword({
    email: target.email,
    password: target.password,
  });
  if (result.error || result.data.user?.id !== target.id)
    throw new HttpError("Demo sign-in failed", 503);
  const { error: audit } = await service
    .from("audit_events")
    .insert({
      event: `DEMO_${role.toUpperCase()}_SIGNED_IN`,
      resource_id: session.workspace_id,
      actor_id: target.id,
    });
  if (audit) throw audit;
  return { role };
}
