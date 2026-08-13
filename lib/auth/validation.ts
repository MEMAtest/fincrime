/**
 * Pure validation helpers for the app/api/auth/** route handlers. Kept
 * dependency-free (no db, no NextResponse) so they can be unit tested
 * directly, mirroring lib/control-tests/validation.ts and friends. The email
 * regex mirrors lib/workspace/settings.ts's EMAIL_RE (kept as a separate
 * copy rather than a shared import, since that module's export is
 * workspace-settings-specific and this one wants to stay free of any
 * dependency on lib/workspace/*).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && EMAIL_RE.test(value);
}

/** Normalises an email for storage/lookup: trimmed, lower-cased. Uniqueness is enforced in SQL on lower(email) too - this just keeps app-level comparisons consistent with that. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 512;

export function isValidPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= MIN_PASSWORD_LENGTH && value.length <= MAX_PASSWORD_LENGTH;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
