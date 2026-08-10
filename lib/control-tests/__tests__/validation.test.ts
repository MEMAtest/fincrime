import { describe, expect, it } from "vitest";
import {
  isControlTestMethod,
  isFindingSeverity,
  isIsoDate,
  isNonNegativeInt,
  isUuid,
  MAX_SAMPLE_COUNT,
  parseOptionalCount,
  parseOptionalStep,
} from "../validation";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

describe("isUuid", () => {
  it("accepts a well-formed UUID", () => {
    expect(isUuid(VALID_UUID)).toBe(true);
  });

  it("rejects a non-UUID string and non-string values", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe("isIsoDate", () => {
  it("accepts a valid ISO date", () => {
    expect(isIsoDate("2026-08-09")).toBe(true);
  });

  it("rejects a malformed date string", () => {
    expect(isIsoDate("09-08-2026")).toBe(false);
    expect(isIsoDate("2026/08/09")).toBe(false);
    expect(isIsoDate("not-a-date")).toBe(false);
  });

  it("rejects a calendar-invalid date", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isIsoDate(20260809)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe("isControlTestMethod", () => {
  it("accepts each valid method", () => {
    for (const m of ["sample", "walkthrough", "reperformance", "data_analysis", "other"]) {
      expect(isControlTestMethod(m)).toBe(true);
    }
  });

  it("rejects an unknown method", () => {
    expect(isControlTestMethod("interview")).toBe(false);
    expect(isControlTestMethod(null)).toBe(false);
  });
});

describe("isFindingSeverity", () => {
  it("accepts low, medium, high", () => {
    expect(isFindingSeverity("low")).toBe(true);
    expect(isFindingSeverity("medium")).toBe(true);
    expect(isFindingSeverity("high")).toBe(true);
  });

  it("rejects an unknown severity", () => {
    expect(isFindingSeverity("critical")).toBe(false);
    expect(isFindingSeverity(undefined)).toBe(false);
  });
});

describe("isNonNegativeInt", () => {
  it("accepts zero and positive integers", () => {
    expect(isNonNegativeInt(0)).toBe(true);
    expect(isNonNegativeInt(42)).toBe(true);
  });

  it("rejects negative numbers, floats, NaN and non-numbers", () => {
    expect(isNonNegativeInt(-1)).toBe(false);
    expect(isNonNegativeInt(1.5)).toBe(false);
    expect(isNonNegativeInt(Number.NaN)).toBe(false);
    expect(isNonNegativeInt("5")).toBe(false);
    expect(isNonNegativeInt(null)).toBe(false);
  });

  it("rejects a value beyond MAX_SAMPLE_COUNT (would overflow the int4 sampleSize column)", () => {
    expect(isNonNegativeInt(MAX_SAMPLE_COUNT)).toBe(true);
    expect(isNonNegativeInt(MAX_SAMPLE_COUNT + 1)).toBe(false);
    expect(isNonNegativeInt(2_147_483_648)).toBe(false); // one past int4 max
  });
});

describe("parseOptionalCount", () => {
  it("passes through undefined as not-provided", () => {
    expect(parseOptionalCount(undefined)).toEqual({ ok: true, value: undefined });
  });

  it("accepts explicit null as clear", () => {
    expect(parseOptionalCount(null)).toEqual({ ok: true, value: null });
  });

  it("accepts a non-negative integer", () => {
    expect(parseOptionalCount(7)).toEqual({ ok: true, value: 7 });
  });

  it("rejects a negative number", () => {
    expect(parseOptionalCount(-3)).toEqual({ ok: false });
  });

  it("rejects a float", () => {
    expect(parseOptionalCount(3.2)).toEqual({ ok: false });
  });

  it("rejects a non-numeric value", () => {
    expect(parseOptionalCount("7")).toEqual({ ok: false });
  });
});

describe("parseOptionalStep", () => {
  it("passes through undefined", () => {
    expect(parseOptionalStep(undefined)).toEqual({ ok: true, value: undefined });
  });

  it("accepts integers 1 through 5", () => {
    for (let i = 1; i <= 5; i++) {
      expect(parseOptionalStep(i)).toEqual({ ok: true, value: i });
    }
  });

  it("rejects 0 and 6 (out of range)", () => {
    expect(parseOptionalStep(0)).toEqual({ ok: false });
    expect(parseOptionalStep(6)).toEqual({ ok: false });
  });

  it("rejects non-integers", () => {
    expect(parseOptionalStep(2.5)).toEqual({ ok: false });
    expect(parseOptionalStep("3")).toEqual({ ok: false });
  });
});
