import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
const key = (secret: string) =>
  createHash("sha256")
    .update("ltr-demo-credentials-v1\0" + secret)
    .digest();
export function sealDemoCredentials(value: unknown, secret: string) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([
    c.update(JSON.stringify(value), "utf8"),
    c.final(),
  ]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}
export function openDemoCredentials(value: string, secret: string) {
  const b = Buffer.from(value, "base64url");
  const d = createDecipheriv("aes-256-gcm", key(secret), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8"),
  );
}
export const demoTokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
