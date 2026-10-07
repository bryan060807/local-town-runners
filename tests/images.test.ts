import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { sanitizeImage } from "../src/lib/images";
test("raster processing resizes and strips identifying metadata", async () => {
  const input = await sharp({
    create: { width: 1600, height: 800, channels: 3, background: "#aabbcc" },
  })
    .withMetadata({ exif: { IFD0: { Artist: "Private marker" } } })
    .png()
    .toBuffer();
  assert.ok((await sharp(input).metadata()).exif);
  const output = await sanitizeImage(input);
  const m = await sharp(output).metadata();
  assert.equal(m.format, "webp");
  assert.equal(m.width, 1280);
  assert.equal(m.exif, undefined);
});
test("SVG/scripts, truncated raster and oversized inputs are rejected", async () => {
  await assert.rejects(() =>
    sanitizeImage(Buffer.from("<svg><script>alert(1)</script></svg>")),
  );
  await assert.rejects(() => sanitizeImage(Buffer.from([255, 216, 255])));
  await assert.rejects(() =>
    sanitizeImage(new Uint8Array(5 * 1024 * 1024 + 1)),
  );
});

test("public asset URLs cannot target arbitrary hosts or script-like file paths", async () => {
  const { safeAssetUrl } = await import("../src/lib/assets");
  const root = "https://project.supabase.co";
  const path =
    "/storage/v1/object/public/marketplace-assets/vendor/00000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002.webp";
  assert.equal(safeAssetUrl(root + path, root), root + path);
  assert.equal(safeAssetUrl("https://evil.test" + path, root), undefined);
  assert.equal(
    safeAssetUrl(
      root + "/storage/v1/object/public/marketplace-assets/test.svg",
      root,
    ),
    undefined,
  );
});
