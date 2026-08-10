import { describe, expect, it } from "vitest";
import {
  isIncidentSource,
  isIncidentSeverity,
  isIncidentStatus,
  isPatchableIncidentStatus,
  isRootCauseCategory,
  isIncidentLinkType,
  isWorkspaceOwnedLinkType,
  isUuid,
  isIsoDate,
  isIsoTimestamp,
  toEpochMillis,
  parseOptionalStep,
  parseAffectedPopulation,
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

  it("rejects a calendar-invalid date", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
  });

  it("rejects a malformed date string", () => {
    expect(isIsoDate("09-08-2026")).toBe(false);
    expect(isIsoDate("not-a-date")).toBe(false);
  });
});

describe("isIsoTimestamp", () => {
  it("accepts a full ISO timestamp", () => {
    expect(isIsoTimestamp("2026-08-09T10:30:00.000Z")).toBe(true);
  });

  it("accepts a full ISO timestamp with an explicit offset instead of Z", () => {
    expect(isIsoTimestamp("2026-08-09T10:30:00+01:00")).toBe(true);
  });

  it("accepts a bare ISO date", () => {
    expect(isIsoTimestamp("2026-08-09")).toBe(true);
  });

  it("rejects garbage and empty strings", () => {
    expect(isIsoTimestamp("not-a-date")).toBe(false);
    expect(isIsoTimestamp("")).toBe(false);
    expect(isIsoTimestamp(null)).toBe(false);
    expect(isIsoTimestamp(undefined)).toBe(false);
  });

  it("rejects a bare year, which new Date() alone accepts as Jan 1st", () => {
    expect(isIsoTimestamp("2026")).toBe(false);
  });

  it("rejects bare numeric strings, which new Date() alone accepts as an offset from epoch", () => {
    expect(isIsoTimestamp("0")).toBe(false);
    expect(isIsoTimestamp("5")).toBe(false);
  });

  it("rejects a calendar-invalid date, which new Date() alone rolls over to the next month", () => {
    expect(isIsoTimestamp("2026-02-30")).toBe(false);
    expect(isIsoTimestamp("2026-02-30T00:00:00.000Z")).toBe(false);
  });
});

describe("toEpochMillis", () => {
  it("returns null for null, undefined, and empty string", () => {
    expect(toEpochMillis(null)).toBeNull();
    expect(toEpochMillis(undefined)).toBeNull();
    expect(toEpochMillis("")).toBeNull();
  });

  it("returns null for an unparseable string", () => {
    expect(toEpochMillis("not-a-date")).toBeNull();
  });

  it("normalises a Date object and an equivalent ISO string to the same value", () => {
    const iso = "2026-05-01T00:00:00.000Z";
    const date = new Date(iso);
    expect(toEpochMillis(date)).toBe(toEpochMillis(iso));
  });

  it(
    "orders a Date (stored/existing side) against a string (incoming/request side) correctly regardless of which side is which - " +
      "this is the exact shape of the occurredAt/detectedAt comparison bug: pg returns timestamptz columns as Date objects while " +
      "the request body is always a string, and a raw `a > b` comparison between those two representations is always false",
    () => {
      const earlierDate = new Date("2026-02-01T00:00:00.000Z");
      const laterString = "2026-05-01T00:00:00.000Z";

      // stored side is a Date, incoming side is a string
      expect((toEpochMillis(laterString) ?? 0) > (toEpochMillis(earlierDate) ?? 0)).toBe(true);
      // stored side is a string, incoming side is a Date
      const laterDate = new Date("2026-05-01T00:00:00.000Z");
      const earlierString = "2026-02-01T00:00:00.000Z";
      expect((toEpochMillis(laterDate) ?? 0) > (toEpochMillis(earlierString) ?? 0)).toBe(true);
    }
  );
});

describe("isIncidentSource", () => {
  it("accepts each valid source", () => {
    for (const s of ["internal_detection", "customer_complaint", "regulator", "third_party", "audit", "control_test", "other"]) {
      expect(isIncidentSource(s)).toBe(true);
    }
  });

  it("rejects an unknown source", () => {
    expect(isIncidentSource("gossip")).toBe(false);
    expect(isIncidentSource(null)).toBe(false);
  });
});

describe("isIncidentSeverity", () => {
  it("accepts low, medium, high, critical", () => {
    for (const s of ["low", "medium", "high", "critical"]) {
      expect(isIncidentSeverity(s)).toBe(true);
    }
  });

  it("rejects an unknown severity", () => {
    expect(isIncidentSeverity("severe")).toBe(false);
    expect(isIncidentSeverity(undefined)).toBe(false);
  });
});

describe("isIncidentStatus", () => {
  it("accepts every lifecycle status", () => {
    for (const s of ["open", "contained", "investigating", "remediating", "closed", "cancelled"]) {
      expect(isIncidentStatus(s)).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    expect(isIncidentStatus("archived")).toBe(false);
  });
});

describe("isPatchableIncidentStatus", () => {
  it("accepts the four forward statuses", () => {
    for (const s of ["open", "contained", "investigating", "remediating"]) {
      expect(isPatchableIncidentStatus(s)).toBe(true);
    }
  });

  it("rejects closed and cancelled (they have dedicated routes)", () => {
    expect(isPatchableIncidentStatus("closed")).toBe(false);
    expect(isPatchableIncidentStatus("cancelled")).toBe(false);
  });
});

describe("isRootCauseCategory", () => {
  it("accepts each valid category", () => {
    for (const c of [
      "control_design",
      "control_operation",
      "data_quality",
      "system_failure",
      "human_error",
      "third_party",
      "process_gap",
      "other",
    ]) {
      expect(isRootCauseCategory(c)).toBe(true);
    }
  });

  it("rejects an unknown category", () => {
    expect(isRootCauseCategory("bad_luck")).toBe(false);
  });
});

describe("isIncidentLinkType / isWorkspaceOwnedLinkType", () => {
  it("accepts each valid link type", () => {
    for (const t of ["failed_control", "control_change", "control_test", "pra_assessment", "enforcement_case"]) {
      expect(isIncidentLinkType(t)).toBe(true);
    }
  });

  it("rejects an unknown link type", () => {
    expect(isIncidentLinkType("random")).toBe(false);
  });

  it("treats enforcement_case as NOT workspace-owned, and the rest as workspace-owned", () => {
    expect(isWorkspaceOwnedLinkType("enforcement_case")).toBe(false);
    expect(isWorkspaceOwnedLinkType("failed_control")).toBe(true);
    expect(isWorkspaceOwnedLinkType("control_change")).toBe(true);
    expect(isWorkspaceOwnedLinkType("control_test")).toBe(true);
    expect(isWorkspaceOwnedLinkType("pra_assessment")).toBe(true);
  });
});

describe("parseOptionalStep", () => {
  it("passes through undefined", () => {
    expect(parseOptionalStep(undefined)).toEqual({ ok: true, value: undefined });
  });

  it("accepts integers 1 through 7", () => {
    for (let i = 1; i <= 7; i++) {
      expect(parseOptionalStep(i)).toEqual({ ok: true, value: i });
    }
  });

  it("rejects 0 and 8 (out of range)", () => {
    expect(parseOptionalStep(0)).toEqual({ ok: false });
    expect(parseOptionalStep(8)).toEqual({ ok: false });
  });

  it("rejects non-integers", () => {
    expect(parseOptionalStep(2.5)).toEqual({ ok: false });
    expect(parseOptionalStep("3")).toEqual({ ok: false });
  });
});

describe("parseAffectedPopulation", () => {
  it("defaults undefined/null to an empty object", () => {
    expect(parseAffectedPopulation(undefined)).toEqual({ ok: true, value: {} });
    expect(parseAffectedPopulation(null)).toEqual({ ok: true, value: {} });
  });

  it("accepts a fully populated shape", () => {
    const input = {
      customersAffected: 120,
      transactionsAffected: 45,
      valueGbp: 98000,
      identificationMethod: "sample review",
      notes: "escalated by ops",
    };
    expect(parseAffectedPopulation(input)).toEqual({ ok: true, value: input });
  });

  it("rejects a non-object", () => {
    expect(parseAffectedPopulation("bad").ok).toBe(false);
    expect(parseAffectedPopulation(42).ok).toBe(false);
    expect(parseAffectedPopulation([1, 2]).ok).toBe(false);
  });

  it("rejects an unknown field rather than silently dropping it", () => {
    const result = parseAffectedPopulation({ customersAffected: 5, bogus: true });
    expect(result.ok).toBe(false);
  });

  it("rejects a negative numeric field", () => {
    expect(parseAffectedPopulation({ customersAffected: -1 }).ok).toBe(false);
  });

  it("rejects a non-numeric numeric field", () => {
    expect(parseAffectedPopulation({ valueGbp: "lots" }).ok).toBe(false);
  });

  it("rejects a non-string text field", () => {
    expect(parseAffectedPopulation({ notes: 42 }).ok).toBe(false);
  });

  it("rejects a fractional customersAffected/transactionsAffected (counts must be whole numbers)", () => {
    expect(parseAffectedPopulation({ customersAffected: 1.5 }).ok).toBe(false);
    expect(parseAffectedPopulation({ transactionsAffected: 2.5 }).ok).toBe(false);
  });

  it("accepts a fractional valueGbp (money, not a count)", () => {
    expect(parseAffectedPopulation({ valueGbp: 1250.5 })).toEqual({ ok: true, value: { valueGbp: 1250.5 } });
  });

  it("rejects Number.MAX_VALUE, which Number.isFinite alone lets through", () => {
    expect(parseAffectedPopulation({ valueGbp: Number.MAX_VALUE }).ok).toBe(false);
    expect(parseAffectedPopulation({ customersAffected: Number.MAX_VALUE }).ok).toBe(false);
  });

  it("accepts Number.MAX_SAFE_INTEGER as the boundary", () => {
    expect(parseAffectedPopulation({ valueGbp: Number.MAX_SAFE_INTEGER }).ok).toBe(true);
  });
});
