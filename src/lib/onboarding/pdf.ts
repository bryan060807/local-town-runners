import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
export type ConsentPDF = {
  id: string;
  kind: string;
  version: string;
  source_sha256: string;
  created_at: string;
  typed_name: string;
  verified_email?: string;
  text_snapshot: { heading: string; text: string }[];
  signature: number[][][];
  application?: unknown;
  presentation?: boolean;
};
export async function consentPdf(s: ConsentPDF) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${s.kind} agreement ${s.version}`);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(
    await readFile(process.cwd() + "/public/fonts/DejaVuSans.ttf"),
    { subset: true },
  );
  let page = doc.addPage([595, 842]),
    y = 790;
  function line(t: string, size = 11) {
    if (y < 60) {
      page = doc.addPage([595, 842]);
      y = 790;
    }
    page.drawText(t, { x: 42, y, size, font, color: rgb(0.08, 0.12, 0.1) });
    y -= size + 7;
  }
  function paragraph(t: string, size = 11) {
    for (const raw of t.replace(/[\u200b\f]/g, "").split("\n")) {
      let l = "";
      for (const char of raw) {
        if (font.widthOfTextAtSize(l + char, size) > 510 && l) {
          const split = l.lastIndexOf(" ");
          if (split > 0) {
            line(l.slice(0, split), size);
            l = l.slice(split + 1) + char;
          } else {
            line(l, size);
            l = char;
          }
        } else l += char;
      }
      line(l, size);
    }
    y -= 8;
  }
  paragraph("Local Town Runners — Completed electronic agreement", 16);
  if (s.presentation)
    paragraph("Presentation copy — original signed evidence retained", 11);
  paragraph(
    `Agreement: ${s.kind} ${s.version}\nSubmission: ${s.id}\nSource SHA256: ${s.source_sha256}`,
  );
  // Keep identity, affirmative consent, timestamp and signature together before legal text.
  paragraph(
    `Signer: ${s.typed_name}\nAuthenticated email: ${s.verified_email ?? "not recorded"}\nAccepted: ${s.created_at}\nExplicit affirmative consent recorded. Drawn signature is electronic evidence, not a cryptographically certified signature.`,
  );
  if (s.signature.length) {
    paragraph("Drawn signature", 13);
    for (const stroke of s.signature)
      for (let i = 1; i < stroke.length; i++) {
        const a = stroke[i - 1],
          b = stroke[i];
        page.drawLine({
          start: { x: 42 + a[0] * 0.65, y: y - a[1] * 0.65 },
          end: { x: 42 + b[0] * 0.65, y: y - b[1] * 0.65 },
          thickness: 1.5,
        });
      }
    y -= 145;
  }
  for (const section of s.text_snapshot) {
    if (y < 130) {
      page = doc.addPage([595, 842]);
      y = 790;
    }
    paragraph(section.heading, 13);
    paragraph(section.text);
  }
  const application =
    s.application && typeof s.application === "object"
      ? (s.application as Record<string, unknown>)
      : {};
  const value = (v: unknown): string =>
    typeof v === "string" || typeof v === "number"
      ? String(v)
      : Array.isArray(v)
        ? v.filter((x) => typeof x === "string").join(", ")
        : "Not provided";
  const field = (label: string, v: unknown) =>
    paragraph(`${label}: ${value(v) || "Not provided"}`);
  paragraph(
    s.kind === "vendor"
      ? "Completed Vendor Application"
      : "Completed Application",
    14,
  );
  for (const [label, key] of [
    ["Business Name", "name"],
    ["Authorized Representative", "representative"],
    ["Contact Information", "phone"],
    ["Vendor Category", "category"],
    ["Business Description", "description"],
    ["Service Area", "serviceArea"],
    ["Additional Business Information", "businessInfo"],
  ]) {
    if (s.kind === "vendor" || application[key] !== undefined)
      field(label, application[key]);
  }
  for (const [label, key] of [
    ["Transportation", "transportation"],
    ["Availability", "availability"],
    ["Radius (miles)", "radius"],
    ["Maximum Detour (miles)", "maxDetour"],
    ["Travel Areas", "travelAreas"],
    ["Pickup Areas", "pickupAreas"],
    ["Route Preferences", "routePreferences"],
    ["Delivery Types", "deliveryTypes"],
    ["Eligibility Information", "eligibility"],
  ])
    if (application[key] !== undefined) field(label, application[key]);
  if (Array.isArray(application.products))
    for (const [index, product] of application.products.entries()) {
      if (!product || typeof product !== "object") continue;
      if (y < 160) {
        page = doc.addPage([595, 842]);
        y = 790;
      }
      paragraph(`Product or Service ${index + 1}`, 13);
      field("Product or Service Name", product.title);
      field("SELL / MAKE / DO", product.mode);
      field("Description", product.description);
      field(
        "Price (USD)",
        typeof product.priceCents === "number"
          ? new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: "USD",
            }).format(product.priceCents / 100)
          : undefined,
      );
      field("Inventory", product.inventory);
      field("Availability", product.availability);
    }
  return Buffer.from(await doc.save());
}
