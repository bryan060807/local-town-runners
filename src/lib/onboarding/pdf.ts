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
  paragraph(
    `Submission: ${s.id}\nAgreement: ${s.kind} ${s.version}\nAccepted: ${s.created_at}\nSource SHA256: ${s.source_sha256}\nSigner: ${s.typed_name}\nVerified email: ${s.verified_email ?? "not recorded"}\nExplicit affirmative consent recorded. Drawn signature is electronic evidence, not a cryptographically certified signature.`,
  );
  for (const section of s.text_snapshot) {
    paragraph(section.heading, 13);
    paragraph(section.text);
  }
  paragraph("Completed application information", 13);
  paragraph(JSON.stringify(s.application ?? {}, null, 2));
  if (s.signature.length) {
    if (y < 220) {
      page = doc.addPage([595, 842]);
      y = 790;
    }
    paragraph("Drawn signature", 13);
    for (const stroke of s.signature)
      for (let i = 1; i < stroke.length; i++) {
        const a = stroke[i - 1],
          b = stroke[i];
        page.drawLine({
          start: { x: 42 + a[0] * 0.8, y: y - a[1] * 0.8 },
          end: { x: 42 + b[0] * 0.8, y: y - b[1] * 0.8 },
          thickness: 1.5,
        });
      }
  }
  return Buffer.from(await doc.save());
}
