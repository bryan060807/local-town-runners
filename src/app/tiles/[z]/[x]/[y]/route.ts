import { z } from "zod";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const p = z
    .object({
      z: z.coerce.number().int().min(0).max(18),
      x: z.coerce.number().int().min(0),
      y: z.coerce.number().int().min(0),
    })
    .safeParse(await params);
  if (!p.success || p.data.x >= 2 ** p.data.z || p.data.y >= 2 ** p.data.z)
    return new Response("Invalid tile", { status: 400 });
  try {
    const { z: zoom, x, y } = p.data;
    const r = await fetch(
      `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
      {
        headers: {
          "User-Agent":
            "LocalTownRunners/0.1 (local-commerce demo; OpenStreetMap attribution retained)",
        },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!r.ok || !r.headers.get("content-type")?.startsWith("image/png"))
      return new Response("Map provider unavailable", { status: 502 });
    const bytes = await r.arrayBuffer();
    if (bytes.byteLength > 512000)
      return new Response("Invalid map response", { status: 502 });
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control":
          r.headers.get("cache-control") || "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Map provider unavailable", { status: 502 });
  }
}
