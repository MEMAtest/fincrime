/**
 * Password hashing using node:crypto's scrypt (no new dependency). Format is
 * "scrypt:<N>:<r>:<p>:<saltHex>:<hashHex>" - the cost parameters travel with
 * the hash itself, so a future change to the cost (e.g. bumping N as
 * hardware gets faster) can re-hash on next successful login without a
 * migration: verify() always uses whatever parameters are embedded in the
 * stored string, not today's constants.
 */
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt cost parameters. N=16384 (2^14) is the interactive-login-friendly
// end of OWASP's recommended range; r=8, p=1 are the standard companions.
// Stored alongside every hash (see format above) so these can change later
// without invalidating existing hashes.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const SCRYPT_MAXMEM = 128 * SCRYPT_N * SCRYPT_R * 2; // headroom over the default 32MB ceiling at N=16384,r=8

function scryptHash(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  const options: ScryptOptions = { N: n, r, p, maxmem: SCRYPT_MAXMEM };
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/**
 * Hashes a password with a fresh random salt. Two calls with the SAME
 * password produce DIFFERENT output strings (different salt, different
 * digest) - this is the point of salting, not a bug; verify() is what
 * checks equality.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptHash(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${derived.toString("hex")}`;
}

/**
 * Verifies a password against a stored hash string, using the cost
 * parameters embedded in that string (not today's constants), so an older
 * hash created under different parameters still verifies correctly. The
 * final comparison is constant-time (timingSafeEqual) so response time does
 * not leak how many bytes of the derived key matched; a malformed stored
 * hash returns false rather than throwing, so a corrupted row cannot be
 * used to distinguish "no such format" from "wrong password" through an
 * unhandled exception either.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number.parseInt(parts[1], 10);
  const r = Number.parseInt(parts[2], 10);
  const p = Number.parseInt(parts[3], 10);
  const saltHex = parts[4];
  const hashHex = parts[5];
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p)) return false;
  if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) return false;

  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scryptHash(password, salt, n, r, p);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/**
 * True if a stored hash was created under weaker parameters than today's
 * constants - the caller (verifyCredentials) can re-hash and persist the
 * password on a successful login, migrating stored hashes gradually with no
 * dedicated migration job.
 */
export function needsRehash(stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  const n = Number.parseInt(parts[1], 10);
  const r = Number.parseInt(parts[2], 10);
  const p = Number.parseInt(parts[3], 10);
  return n !== SCRYPT_N || r !== SCRYPT_R || p !== SCRYPT_P;
}
