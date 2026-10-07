import sharp from "sharp";
export async function sanitizeImage(bytes: Uint8Array) {
  if (bytes.byteLength > 5 * 1024 * 1024) throw Error("Image exceeds 5 MB");
  const b = Buffer.from(bytes);
  const png =
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = b.length >= 3 && b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp =
    b.length >= 12 &&
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP";
  if (!png && !jpeg && !webp)
    throw Error("Only PNG, JPEG and WebP raster images are accepted");
  return sharp(b, { limitInputPixels: 16000000 })
    .rotate()
    .resize({
      width: 1280,
      height: 1280,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
}
