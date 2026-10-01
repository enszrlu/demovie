import "server-only";
import { scryptSync, timingSafeEqual } from "node:crypto";

/** Verifies a password against a `scrypt$<salt>$<hash>` string (base64url parts), as written by scripts/seed.mjs. */
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltPart, hashPart] = stored.split("$");
  if (scheme !== "scrypt" || !saltPart || !hashPart) return false;
  const expected = Buffer.from(hashPart, "base64url");
  if (expected.length === 0) return false;
  const actual = scryptSync(password, Buffer.from(saltPart, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}
