import { z } from "zod";
import { randomUUID } from "node:crypto";
import { authenticated, HttpError, serviceDb } from "@/lib/server/db";
import { sameOrigin, failure, limited } from "@/lib/server/http";
import { sanitizeImage } from "@/lib/images";
const id = z.uuid();
const schema = z.discriminatedUnion("target", [
  z
    .object({ target: z.literal("listing"), vendorId: id, listingId: id })
    .strict(),
  z.object({ target: z.enum(["logo", "cover"]), vendorId: id }).strict(),
  z.object({ target: z.literal("runner") }).strict(),
]);
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const { client, user } = await authenticated();
    await limited(client, "asset_upload");
    const declared = Number(req.headers.get("content-length"));
    if (declared > 6 * 1024 * 1024)
      throw new HttpError("Upload too large", 413);
    const reader = req.body?.getReader();
    if (!reader) throw new HttpError("File required", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const r = await reader.read();
        if (r.done) break;
        size += r.value.byteLength;
        if (size > 6 * 1024 * 1024) {
          await reader.cancel();
          throw new HttpError("Upload too large", 413);
        }
        chunks.push(r.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    chunks.forEach((c) => {
      bytes.set(c, offset);
      offset += c.byteLength;
    });
    const form = await new Response(bytes.buffer, {
      headers: { "Content-Type": req.headers.get("content-type") || "" },
    }).formData();
    if (
      [...form.keys()].some((k) => !["data", "file"].includes(k)) ||
      form.getAll("file").length !== 1
    )
      throw new HttpError("Invalid upload", 400);
    const p = schema.parse(JSON.parse(String(form.get("data"))));
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 5 * 1024 * 1024)
      throw new HttpError("Choose one raster image under 5 MB", 400);
    let path: string;
    if (p.target === "runner") {
      const { data: allowed } = await client.rpc("has_role", {
        wanted: "runner",
      });
      if (!allowed) throw new HttpError("Runner role required", 403);
      path = `runner/${user.id}/${randomUUID()}.webp`;
    } else {
      const { data: allowed } = await client.rpc("owns_vendor", {
        v: p.vendorId,
      });
      if (!allowed) throw new HttpError("Vendor owner required", 403);
      if (p.target === "listing") {
        const { data: item } = await client
          .from("listings")
          .select("id")
          .eq("id", p.listingId)
          .eq("vendor_id", p.vendorId)
          .single();
        if (!item) throw new HttpError("Listing unavailable", 403);
      }
      path = `vendor/${p.vendorId}/${randomUUID()}.webp`;
    }
    let output: Buffer;
    try {
      output = await sanitizeImage(new Uint8Array(await file.arrayBuffer()));
    } catch {
      throw new HttpError(
        "Invalid image. Use a PNG, JPEG or WebP under 5 MB and 16 megapixels.",
        400,
      );
    }
    const storage = serviceDb().storage;
    const upload = await storage
      .from("marketplace-assets")
      .upload(path, output, { contentType: "image/webp", upsert: false });
    if (upload.error)
      throw new HttpError(
        "Image storage is unavailable. Configure Supabase Storage before uploading.",
        503,
      );
    const url = storage.from("marketplace-assets").getPublicUrl(path)
      .data.publicUrl;
    const update =
      p.target === "runner"
        ? await client
            .from("runners")
            .update({ avatar_url: url })
            .eq("id", user.id)
            .select("id")
        : p.target === "listing"
          ? await client
              .from("listings")
              .update({ photos: [url] })
              .eq("id", p.listingId)
              .eq("vendor_id", p.vendorId)
              .select("id")
          : await client
              .from("vendors")
              .update(
                p.target === "logo" ? { logo_url: url } : { cover_url: url },
              )
              .eq("id", p.vendorId)
              .select("id");
    if (update.error || !update.data?.length)
      throw new HttpError(
        "Image uploaded but could not be attached. Retry after checking database configuration.",
        503,
      );
    return Response.json({ url });
  } catch (e) {
    return failure(e);
  }
}
