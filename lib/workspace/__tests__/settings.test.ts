import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  resolveWorkspaceSettings,
  validateSettingsPatch,
  validateAppetiteThresholds,
  isValidEmail,
} from "../settings";

describe("resolveWorkspaceSettings", () => {
  it("fills in every default when the stored blob is empty", () => {
    expect(resolveWorkspaceSettings({})).toEqual(DEFAULT_WORKSPACE_SETTINGS);
    expect(resolveWorkspaceSettings(null)).toEqual(DEFAULT_WORKSPACE_SETTINGS);
    expect(resolveWorkspaceSettings(undefined)).toEqual(DEFAULT_WORKSPACE_SETTINGS);
  });

  it("overrides only the keys actually present in the stored blob", () => {
    const resolved = resolveWorkspaceSettings({ defaultHourlyCostGbp: 50 });
    expect(resolved.defaultHourlyCostGbp).toBe(50);
    expect(resolved.defaultTestSampleSize).toBe(DEFAULT_WORKSPACE_SETTINGS.defaultTestSampleSize);
  });

  it("ignores an unknown/garbage key from a stale stored blob rather than surfacing it", () => {
    const resolved = resolveWorkspaceSettings({ somethingOld: "x", defaultHourlyCostGbp: 40 } as Record<string, unknown>);
    expect(resolved).not.toHaveProperty("somethingOld");
    expect(resolved.defaultHourlyCostGbp).toBe(40);
  });

  it("treats an explicit null organisationName as cleared, not defaulted-away", () => {
    const resolved = resolveWorkspaceSettings({ organisationName: null });
    expect(resolved.organisationName).toBeNull();
  });
});

describe("validateSettingsPatch", () => {
  it("accepts an empty patch", () => {
    const result = validateSettingsPatch(undefined);
    expect(result.ok).toBe(true);
  });

  it("rejects a non-object", () => {
    expect(validateSettingsPatch("nope").ok).toBe(false);
    expect(validateSettingsPatch(5).ok).toBe(false);
    expect(validateSettingsPatch([]).ok).toBe(false);
  });

  it("rejects an unknown key outright rather than silently dropping it", () => {
    const result = validateSettingsPatch({ notARealSetting: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Unknown settings key/);
  });

  it("rejects an out-of-range defaultHourlyCostGbp", () => {
    expect(validateSettingsPatch({ defaultHourlyCostGbp: -5 }).ok).toBe(false);
    expect(validateSettingsPatch({ defaultHourlyCostGbp: 999999 }).ok).toBe(false);
    expect(validateSettingsPatch({ defaultHourlyCostGbp: "50" }).ok).toBe(false);
  });

  it("rejects a non-integer or out-of-range defaultTestSampleSize", () => {
    expect(validateSettingsPatch({ defaultTestSampleSize: 1.5 }).ok).toBe(false);
    expect(validateSettingsPatch({ defaultTestSampleSize: 0 }).ok).toBe(false);
  });

  it("rejects an invalid dateFormat", () => {
    expect(validateSettingsPatch({ dateFormat: "us" }).ok).toBe(false);
  });

  it("rejects an out-of-range reviewReminderDays", () => {
    expect(validateSettingsPatch({ reviewReminderDays: -1 }).ok).toBe(false);
    expect(validateSettingsPatch({ reviewReminderDays: 400 }).ok).toBe(false);
  });

  it("rejects an empty-string organisationName but accepts null", () => {
    expect(validateSettingsPatch({ organisationName: "" }).ok).toBe(false);
    expect(validateSettingsPatch({ organisationName: null }).ok).toBe(true);
  });

  it("accepts a valid full patch and returns exactly the supplied keys", () => {
    const result = validateSettingsPatch({
      defaultHourlyCostGbp: 45,
      defaultTestSampleSize: 30,
      organisationName: "Acme Ltd",
      dateFormat: "iso",
      reviewReminderDays: 14,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch).toEqual({
        defaultHourlyCostGbp: 45,
        defaultTestSampleSize: 30,
        organisationName: "Acme Ltd",
        dateFormat: "iso",
        reviewReminderDays: 14,
      });
    }
  });

  it("returns only the keys present, for a partial patch", () => {
    const result = validateSettingsPatch({ reviewReminderDays: 7 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.patch).toEqual({ reviewReminderDays: 7 });
  });
});

describe("validateAppetiteThresholds", () => {
  it("accepts a valid ascending pair", () => {
    const result = validateAppetiteThresholds({ toleratedFrom: 40, outsideFrom: 60 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.thresholds).toEqual({ toleratedFrom: 40, outsideFrom: 60 });
  });

  it("rejects equal thresholds (empty tolerated band)", () => {
    const result = validateAppetiteThresholds({ toleratedFrom: 50, outsideFrom: 50 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/strictly less than/);
  });

  it("rejects inverted thresholds", () => {
    const result = validateAppetiteThresholds({ toleratedFrom: 70, outsideFrom: 30 });
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-range values", () => {
    expect(validateAppetiteThresholds({ toleratedFrom: -1, outsideFrom: 60 }).ok).toBe(false);
    expect(validateAppetiteThresholds({ toleratedFrom: 40, outsideFrom: 101 }).ok).toBe(false);
  });

  it("rejects non-integer values", () => {
    expect(validateAppetiteThresholds({ toleratedFrom: 40.5, outsideFrom: 60 }).ok).toBe(false);
  });

  it("rejects an unknown key", () => {
    const result = validateAppetiteThresholds({ toleratedFrom: 40, outsideFrom: 60, extra: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/Unknown appetiteThresholds key/);
  });

  it("rejects a non-object", () => {
    expect(validateAppetiteThresholds(null).ok).toBe(false);
    expect(validateAppetiteThresholds("nope").ok).toBe(false);
    expect(validateAppetiteThresholds([40, 60]).ok).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("accepts a well-formed address", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
  });

  it("rejects a malformed address", () => {
    expect(isValidEmail("not-an-email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("@b.com")).toBe(false);
  });
});
