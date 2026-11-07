import { createHash, randomBytes } from "node:crypto";

const PREFIX = "cuely_";
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A new API key. Only its hash and a short prefix are ever stored. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const bytes = randomBytes(32);
  let body = "";
  for (const b of bytes) body += ALPHABET[b % ALPHABET.length];
  const key = `${PREFIX}${body}`;
  return { key, prefix: key.slice(0, PREFIX.length + 6), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Reads a Cuely key from an Authorization header (Bearer) or x-api-key. */
export function readApiKey(req: Request): string | null {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(auth.trim());
  const key = m?.[1] ?? req.headers.get("x-api-key")?.trim() ?? null;
  return key || null;
}

export function looksLikeApiKey(key: string): boolean {
  return key.startsWith(PREFIX) && key.length === PREFIX.length + 32;
}
