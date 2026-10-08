import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  realUser,
  privateBucket,
  assertPrivateStorage,
} from "@/lib/server/onboarding";
import { serviceDb, HttpError } from "@/lib/server/db";
import { sameOrigin, failure, limited } from "@/lib/server/http";
import { sanitizeImage } from "@/lib/images";
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const applicationId = z
      .uuid()
      .parse(new URL(req.url).searchParams.get("application"));
    const { client, user } = await realUser();
    await limited(client, "application_photo");
    const a = await client
      .from("role_applications")
      .select("id,status")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single();
    if (a.error || a.data.status !== "draft")
      throw new HttpError("Save your draft before uploading", 409);
    if (Number(req.headers.get("content-length")) > 5242880)
      throw new HttpError("Image too large", 413);
    const reader = req.body?.getReader();
    if (!reader) throw new HttpError("Image required", 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        size += r.value.length;
        if (size > 5242880) {
          await reader.cancel();
          throw new HttpError("Image too large", 413);
        }
        chunks.push(r.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = Buffer.concat(chunks);
    let output: Buffer;
    try {
      output = await sanitizeImage(bytes);
    } catch {
      throw new HttpError("Use a valid PNG, JPEG or WebP under 5 MB", 400);
    }
    const path = `applications/${user.id}/${applicationId}/${randomUUID()}.webp`;
    await assertPrivateStorage();
    const c = serviceDb();
    const r = await c.storage
      .from(privateBucket)
      .upload(path, output, { contentType: "image/webp", upsert: false });
    if (r.error) throw new HttpError("Private storage is unavailable", 503);
    const asset = await c
      .from("application_assets")
      .insert({ application_id: applicationId, path })
      .select("id")
      .single();
    if (asset.error) {
      await c.storage.from(privateBucket).remove([path]);
      throw Error("Photo reference could not be saved");
    }
    return Response.json({ id: asset.data.id });
  } catch (e) {
    return failure(e);
  }
}
export async function GET(req: Request) {
  try {
    const id = z.uuid().parse(new URL(req.url).searchParams.get("id"));
    const { client } = await realUser();
    const asset = await client
      .from("application_assets")
      .select("path")
      .eq("id", id)
      .single();
    if (asset.error) throw new HttpError("Photograph unavailable", 404);
    const r = await serviceDb()
      .storage.from(privateBucket)
      .createSignedUrl(asset.data.path, 60);
    if (r.error) throw new HttpError("Private storage unavailable", 503);
    return Response.json(
      { url: r.data.signedUrl },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
