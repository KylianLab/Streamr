import crypto from "crypto";

const SECRET = () => process.env.AUTH_SECRET || "fallback";

export function generateStreamToken(mediaFileId: string): string {
  const expires = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
  const payload = `${mediaFileId}:${expires}`;
  const sig = crypto.createHmac("sha256", SECRET()).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyStreamToken(token: string, mediaFileId: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString();
    const [id, expiresStr, sig] = decoded.split(":");
    if (id !== mediaFileId) return false;
    const expires = parseInt(expiresStr);
    if (Date.now() > expires) return false;
    const expected = crypto.createHmac("sha256", SECRET()).update(`${id}:${expiresStr}`).digest("hex");
    return sig === expected;
  } catch {
    return false;
  }
}
