import { z } from "zod";
import {
  realUser,
  adminUser,
  privateBucket,
  assertPrivateStorage,
} from "@/lib/server/onboarding";
import { serviceDb, HttpError } from "@/lib/server/db";
import { failure } from "@/lib/server/http";
export async function GET(req: Request) {
  try {
    const id = z.uuid().parse(new URL(req.url).searchParams.get("id"));
    const presentation =
      new URL(req.url).searchParams.get("presentation") === "1";
    const { client } = presentation ? await adminUser() : await realUser();
    const s = await client
      .from("agreement_submissions")
      .select("id")
      .eq("id", id)
      .single();
    if (s.error) throw new HttpError("Document unavailable", 404);
    const d = await client
      .from(presentation ? "agreement_presentations" : "agreement_documents")
      .select("path")
      .eq("submission_id", id)
      .single();
    if (!d.data?.path) throw new HttpError("PDF generation is pending", 409);
    await assertPrivateStorage();
    const signed = await serviceDb()
      .storage.from(privateBucket)
      .createSignedUrl(d.data.path, 60, {
        download: `LTR-${presentation ? "presentation" : "agreement"}-${id}.pdf`,
      });
    if (signed.error) throw new HttpError("Private storage unavailable", 503);
    return Response.json(
      { url: signed.data.signedUrl, expiresIn: 60 },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch (e) {
    return failure(e);
  }
}
