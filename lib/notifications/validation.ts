/**
 * Validates a PATCH body for /api/notifications/preferences, mirroring the
 * strictness of lib/workspace/settings.ts's validateSettingsPatch: unknown
 * keys are rejected outright rather than silently dropped, every known key
 * is type-checked.
 */
import { DEFAULT_NOTIFICATION_CATEGORIES, type NotificationCategories, type NotificationFrequency } from "./digest";

const FREQUENCIES = new Set<NotificationFrequency>(["off", "daily", "weekly"]);
const CATEGORY_KEYS = Object.keys(DEFAULT_NOTIFICATION_CATEGORIES) as (keyof NotificationCategories)[];

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export function validateFrequency(input: unknown): ValidationResult<NotificationFrequency> {
  if (typeof input !== "string" || !FREQUENCIES.has(input as NotificationFrequency)) {
    return { ok: false, reason: "frequency must be one of 'off', 'daily', 'weekly'" };
  }
  return { ok: true, value: input as NotificationFrequency };
}

/**
 * Returns only the keys actually present in `input` (a PARTIAL patch, like
 * lib/workspace/settings.ts's validateSettingsPatch) so the caller can
 * merge it onto the member's currently stored categories without
 * clobbering any toggle the request did not mention.
 */
export function validateCategoriesPatch(input: unknown): ValidationResult<Partial<NotificationCategories>> {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "categories must be an object" };
  }
  const obj = input as Record<string, unknown>;
  const unknownKeys = Object.keys(obj).filter((key) => !CATEGORY_KEYS.includes(key as keyof NotificationCategories));
  if (unknownKeys.length > 0) {
    return { ok: false, reason: `Unknown categories key(s): ${unknownKeys.join(", ")}` };
  }

  const value: Partial<NotificationCategories> = {};
  for (const key of CATEGORY_KEYS) {
    if (key in obj) {
      if (typeof obj[key] !== "boolean") {
        return { ok: false, reason: `categories.${key} must be a boolean` };
      }
      value[key] = obj[key] as boolean;
    }
  }
  return { ok: true, value };
}
