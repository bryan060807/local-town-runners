import { HttpError } from "./server/errors";
import { readLimitedBytes } from "./request-body";

export async function imageUpload(req: Request) {
  const contentType = req.headers.get("content-type");
  if (!contentType || !/^multipart\/form-data\s*;/i.test(contentType))
    throw new HttpError("Choose one raster image with its upload details", 400);
  const bytes = await readLimitedBytes(req, 6 * 1024 * 1024);
  let form: FormData;
  try {
    form = await new Response(bytes, {
      headers: { "Content-Type": contentType },
    }).formData();
  } catch {
    throw new HttpError("Invalid image upload", 400);
  }
  if (
    [...form.keys()].some((key) => !["data", "file"].includes(key)) ||
    form.getAll("data").length !== 1 ||
    form.getAll("file").length !== 1 ||
    typeof form.get("data") !== "string"
  )
    throw new HttpError("Invalid image upload", 400);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024)
    throw new HttpError("Choose one raster image under 5 MB", 400);
  return { data: form.get("data") as string, file };
}
