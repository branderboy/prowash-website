import crypto from "node:crypto";

/**
 * scrypt-based password hashing using only Node's built-in crypto.
 * Stored format: "salt:hash" (both hex).
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  let expected: Buffer;
  try {
    expected = crypto.scryptSync(password, salt, 64);
  } catch {
    return false;
  }
  const actual = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
