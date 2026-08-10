import { DEFAULT_HOURLY_COST_GBP } from "@/data/scoring/operational-load";
import { DEFAULT_APPETITE_THRESHOLDS, type AppetiteThresholds } from "@/data/scoring/residual-risk";

/**
 * Workspace-level settings, stored in the `settings` JSONB column (see
 * lib/repo/workspace.ts). Every key here is documented once, defaulted once,
 * and wired to exactly one real consumer - see each field's doc comment for
 * where it is actually read. A key with no wired consumer must not be added
 * (Phase 7 brief, "if you cannot wire one cleanly, do not add the key").
 */
export interface WorkspaceSettings {
  /** Fully loaded analyst hourly cost, GBP. Consumed by the operational-load
   *  calculator (components/pra/StepGapsOpLoad.tsx) as the default rate a
   *  control's op-load estimate falls back to when the assessor has not
   *  overridden it per-control. Replaces the hard-coded DEFAULT_HOURLY_COST_GBP
   *  (data/scoring/operational-load.ts) as the workspace's own default; the
   *  pure scoring module itself is untouched and still takes a plain number. */
  defaultHourlyCostGbp: number;
  /** Prefilled as the sampleSize on a newly created control test
   *  (app/assure/control-testing/new/NewTestClient.tsx), still freely
   *  editable per test. */
  defaultTestSampleSize: number;
  /** Printed on every generated PDF's header (lib/pdf/shared.ts addHeader),
   *  alongside the fixed MEMA house branding, so a pack visibly identifies
   *  which firm it was prepared for. Null means "not set" - the header falls
   *  back to its generic subtitle only. */
  organisationName: string | null;
  /** 'en-GB' (DD/MM/YYYY) or 'iso' (YYYY-MM-DD). Consumed by the "Date:"
   *  line printed on every generated PDF's header (lib/pdf/shared.ts
   *  addHeader), alongside organisationName. Not threaded into every
   *  on-screen date in the app (lib/format/date.ts's formatIsoDate is a
   *  pure, context-free helper used from dozens of call sites; retrofitting
   *  a workspace-settings dependency into all of them is out of scope for
   *  this phase) - the PDF header is the one place this is genuinely wired,
   *  not merely stored. */
  dateFormat: "en-GB" | "iso";
  /** Days before a control's next scheduled test date it counts as "due
   *  soon" on the governance dashboard and workspace home. Consumed by
   *  lib/governance/portfolio.ts's due-soon window (previously a hard-coded
   *  30), threaded through lib/governance/load.ts. */
  reviewReminderDays: number;
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  defaultHourlyCostGbp: DEFAULT_HOURLY_COST_GBP,
  defaultTestSampleSize: 25,
  organisationName: null,
  dateFormat: "en-GB",
  reviewReminderDays: 30,
};

const SETTINGS_KEYS = Object.keys(DEFAULT_WORKSPACE_SETTINGS) as (keyof WorkspaceSettings)[];

const DATE_FORMATS = new Set(["en-GB", "iso"]);

/**
 * Same pattern used by app/api/export/pdf/route.ts's email validation - kept
 * in sync deliberately rather than imported cross-module, since that route
 * validates a request field with the same shape but a different purpose
 * (lead-capture email vs workspace owner email). Deliberately excludes
 * `<`, `>`, whitespace and other characters not valid in an email address's
 * local part (the standard HTML5 input[type=email] pattern) - the previous
 * `[^\s@]+@[^\s@]+\.[^\s@]+` shape accepted anything without whitespace or
 * "@", including `<script>@b.com`.
 */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

/**
 * Merges a raw settings JSONB blob (as stored - may be `{}`, may be missing
 * keys from before a given setting existed, must never be trusted to only
 * contain known keys) with the documented defaults. Unknown keys in the
 * stored blob are silently dropped here (they were already rejected at
 * write time by validateSettingsPatch, so their presence would only mean
 * historical data from before a key was renamed/removed).
 */
export function resolveWorkspaceSettings(raw: Record<string, unknown> | null | undefined): WorkspaceSettings {
  const stored = (raw ?? {}) as Partial<Record<keyof WorkspaceSettings, unknown>>;
  const resolved = { ...DEFAULT_WORKSPACE_SETTINGS };

  // Re-enforce the same bounds validateSettingsPatch checks at write time -
  // a stored value from before a bound existed/tightened (or written by any
  // future path that bypasses validateSettingsPatch) must not silently pass
  // straight through to every consumer of resolveWorkspaceSettings.
  if (
    typeof stored.defaultHourlyCostGbp === "number" &&
    Number.isFinite(stored.defaultHourlyCostGbp) &&
    stored.defaultHourlyCostGbp > 0 &&
    stored.defaultHourlyCostGbp <= 10000
  ) {
    resolved.defaultHourlyCostGbp = stored.defaultHourlyCostGbp;
  }
  if (
    typeof stored.defaultTestSampleSize === "number" &&
    Number.isInteger(stored.defaultTestSampleSize) &&
    stored.defaultTestSampleSize >= 1 &&
    stored.defaultTestSampleSize <= 100000
  ) {
    resolved.defaultTestSampleSize = stored.defaultTestSampleSize;
  }
  if (typeof stored.organisationName === "string" && stored.organisationName.trim() && stored.organisationName.length <= 200) {
    resolved.organisationName = stored.organisationName.trim();
  } else if (stored.organisationName === null) {
    resolved.organisationName = null;
  }
  if (typeof stored.dateFormat === "string" && DATE_FORMATS.has(stored.dateFormat)) {
    resolved.dateFormat = stored.dateFormat as WorkspaceSettings["dateFormat"];
  }
  if (
    typeof stored.reviewReminderDays === "number" &&
    Number.isInteger(stored.reviewReminderDays) &&
    stored.reviewReminderDays >= 0 &&
    stored.reviewReminderDays <= 365
  ) {
    resolved.reviewReminderDays = stored.reviewReminderDays;
  }

  return resolved;
}

export type SettingsPatchResult =
  | { ok: true; patch: Partial<WorkspaceSettings> }
  | { ok: false; reason: string };

/**
 * Validates a PATCH body's `settings` object against the documented schema:
 * rejects unknown keys outright (rather than silently dropping them - the
 * exact defect class this project keeps shipping, per the phase brief) and
 * type/range-checks every known key. Returns only the keys that were
 * actually present in `input`, so the caller can merge them onto the
 * existing stored settings without clobbering keys the request did not
 * mention.
 */
export function validateSettingsPatch(input: unknown): SettingsPatchResult {
  if (input === undefined) return { ok: true, patch: {} };
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "settings must be an object" };
  }

  const obj = input as Record<string, unknown>;
  const unknownKeys = Object.keys(obj).filter((key) => !SETTINGS_KEYS.includes(key as keyof WorkspaceSettings));
  if (unknownKeys.length > 0) {
    return { ok: false, reason: `Unknown settings key(s): ${unknownKeys.join(", ")}` };
  }

  const patch: Partial<WorkspaceSettings> = {};

  if ("defaultHourlyCostGbp" in obj) {
    const v = obj.defaultHourlyCostGbp;
    // Strictly greater than 0, not >= 0: this feeds a multiplication in
    // scoreOperationalLoad's cost calculation, so 0 does not mean "no
    // default" - it silently zeroes every control's estimated monthly cost
    // that falls back to it.
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 10000) {
      return { ok: false, reason: "defaultHourlyCostGbp must be a number greater than 0 and at most 10000" };
    }
    patch.defaultHourlyCostGbp = v;
  }

  if ("defaultTestSampleSize" in obj) {
    const v = obj.defaultTestSampleSize;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 100000) {
      return { ok: false, reason: "defaultTestSampleSize must be an integer between 1 and 100000" };
    }
    patch.defaultTestSampleSize = v;
  }

  if ("organisationName" in obj) {
    const v = obj.organisationName;
    if (v !== null && (typeof v !== "string" || v.trim().length === 0 || v.length > 200)) {
      return { ok: false, reason: "organisationName must be a non-empty string (max 200 chars) or null" };
    }
    patch.organisationName = v === null ? null : v.trim();
  }

  if ("dateFormat" in obj) {
    const v = obj.dateFormat;
    if (typeof v !== "string" || !DATE_FORMATS.has(v)) {
      return { ok: false, reason: "dateFormat must be 'en-GB' or 'iso'" };
    }
    patch.dateFormat = v as WorkspaceSettings["dateFormat"];
  }

  if ("reviewReminderDays" in obj) {
    const v = obj.reviewReminderDays;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 365) {
      return { ok: false, reason: "reviewReminderDays must be an integer between 0 and 365" };
    }
    patch.reviewReminderDays = v;
  }

  return { ok: true, patch };
}

export type AppetiteThresholdsResult =
  | { ok: true; thresholds: AppetiteThresholds }
  | { ok: false; reason: string };

/**
 * Validates an appetiteThresholds patch: both bounds must be integers 0-100,
 * and toleratedFrom must be STRICTLY less than outsideFrom (equal or
 * inverted thresholds would make the "tolerated" band empty or negative-
 * width, silently misclassifying every residual score - rejected outright
 * rather than accepted and left to confuse compareToAppetite downstream).
 */
export function validateAppetiteThresholds(input: unknown): AppetiteThresholdsResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "appetiteThresholds must be an object with toleratedFrom and outsideFrom" };
  }
  const obj = input as Record<string, unknown>;
  const allowedKeys = new Set(["toleratedFrom", "outsideFrom"]);
  const unknownKeys = Object.keys(obj).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    return { ok: false, reason: `Unknown appetiteThresholds key(s): ${unknownKeys.join(", ")}` };
  }

  const { toleratedFrom, outsideFrom } = obj;
  if (typeof toleratedFrom !== "number" || !Number.isInteger(toleratedFrom) || toleratedFrom < 0 || toleratedFrom > 100) {
    return { ok: false, reason: "toleratedFrom must be an integer between 0 and 100" };
  }
  if (typeof outsideFrom !== "number" || !Number.isInteger(outsideFrom) || outsideFrom < 0 || outsideFrom > 100) {
    return { ok: false, reason: "outsideFrom must be an integer between 0 and 100" };
  }
  if (toleratedFrom >= outsideFrom) {
    return {
      ok: false,
      reason: "toleratedFrom must be strictly less than outsideFrom (equal or inverted thresholds leave no tolerated band)",
    };
  }

  return { ok: true, thresholds: { toleratedFrom, outsideFrom } };
}

export { DEFAULT_APPETITE_THRESHOLDS };
