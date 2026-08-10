import { describe, expect, it } from "vitest";
import {
  isEntityType,
  isJurisdiction,
  isReadinessRiskLevel,
  isReadinessStatus,
  isReadinessGap,
  isUuid,
  isIsoDate,
  parseOptionalStep,
} from "../validation";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

describe("isEntityType", () => {
  it("accepts every entity type in the real data/kyc enum", () => {
    for (const t of [
      "regulated_entity",
      "listed_entity",
      "corporate",
      "individual",
      "sole_trader",
      "partnership",
      "limited_partnership",
      "trust",
      "charity",
      "fund",
      "foundation",
      "stak",
      "swf",
      "tcsp_client",
      "tcsp_partner",
      "government",
      "spv",
      "introductory_broker",
      "program_manager",
    ]) {
      expect(isEntityType(t)).toBe(true);
    }
  });

  it("rejects an unknown entity type and non-string values", () => {
    expect(isEntityType("shell_company")).toBe(false);
    expect(isEntityType(null)).toBe(false);
    expect(isEntityType(undefined)).toBe(false);
    expect(isEntityType(42)).toBe(false);
  });
});

describe("isJurisdiction", () => {
  it("accepts every jurisdiction in the real data/kyc enum", () => {
    for (const j of ["global", "uk", "us", "eu", "de", "fr", "sg", "hk"]) {
      expect(isJurisdiction(j)).toBe(true);
    }
  });

  it("rejects an unknown jurisdiction", () => {
    expect(isJurisdiction("jp")).toBe(false);
    expect(isJurisdiction(null)).toBe(false);
  });
});

describe("isReadinessRiskLevel", () => {
  it("accepts low, medium, high", () => {
    for (const r of ["low", "medium", "high"]) expect(isReadinessRiskLevel(r)).toBe(true);
  });

  it("rejects an unknown risk level", () => {
    expect(isReadinessRiskLevel("critical")).toBe(false);
  });
});

describe("isReadinessStatus", () => {
  it("accepts every lifecycle status", () => {
    for (const s of ["draft", "in_review", "approved_local", "approved_global", "rejected", "cancelled"]) {
      expect(isReadinessStatus(s)).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    expect(isReadinessStatus("archived")).toBe(false);
  });
});

describe("isReadinessGap", () => {
  it("accepts every gap value", () => {
    for (const g of ["not_assessed", "none", "partial", "full"]) expect(isReadinessGap(g)).toBe(true);
  });

  it("rejects an unknown gap value", () => {
    expect(isReadinessGap("total")).toBe(false);
  });
});

describe("isUuid", () => {
  it("accepts a well-formed UUID", () => {
    expect(isUuid(VALID_UUID)).toBe(true);
  });

  it("rejects a non-UUID string and non-string values", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe("isIsoDate", () => {
  it("accepts a valid ISO date", () => {
    expect(isIsoDate("2026-08-09")).toBe(true);
  });

  it("rejects a calendar-invalid date", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
  });

  it("rejects a malformed date string", () => {
    expect(isIsoDate("09-08-2026")).toBe(false);
    expect(isIsoDate("not-a-date")).toBe(false);
  });
});

describe("parseOptionalStep", () => {
  it("passes through undefined", () => {
    expect(parseOptionalStep(undefined)).toEqual({ ok: true, value: undefined });
  });

  it("accepts integers 1 through 6", () => {
    for (let i = 1; i <= 6; i++) {
      expect(parseOptionalStep(i)).toEqual({ ok: true, value: i });
    }
  });

  it("rejects 0 and 7 (out of range)", () => {
    expect(parseOptionalStep(0)).toEqual({ ok: false });
    expect(parseOptionalStep(7)).toEqual({ ok: false });
  });

  it("rejects non-integers", () => {
    expect(parseOptionalStep(2.5)).toEqual({ ok: false });
    expect(parseOptionalStep("3")).toEqual({ ok: false });
  });
});
