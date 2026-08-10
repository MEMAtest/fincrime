import { describe, expect, it } from "vitest";
import {
  isRegRequestChannel,
  isRegRequestStatus,
  isRegQuestionStatus,
  isRegQuestionLinkType,
  isRegCommitmentStatus,
  isTerminalCommitmentStatus,
  isUuid,
  isIsoDate,
  parseOptionalStep,
  parsePosition,
} from "../validation";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

describe("isRegRequestChannel", () => {
  it("accepts every channel", () => {
    for (const c of ["email", "portal", "letter", "meeting", "s165", "other"]) expect(isRegRequestChannel(c)).toBe(true);
  });

  it("rejects an unknown channel and non-string values", () => {
    expect(isRegRequestChannel("fax")).toBe(false);
    expect(isRegRequestChannel(null)).toBe(false);
    expect(isRegRequestChannel(undefined)).toBe(false);
  });
});

describe("isRegRequestStatus", () => {
  it("accepts every lifecycle status", () => {
    for (const s of ["draft", "in_progress", "in_review", "approved", "submitted", "closed", "cancelled"]) {
      expect(isRegRequestStatus(s)).toBe(true);
    }
  });

  it("rejects an unknown status", () => {
    expect(isRegRequestStatus("rejected")).toBe(false);
    expect(isRegRequestStatus("archived")).toBe(false);
  });
});

describe("isRegQuestionStatus", () => {
  it("accepts unanswered, drafted, reviewed", () => {
    for (const s of ["unanswered", "drafted", "reviewed"]) expect(isRegQuestionStatus(s)).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(isRegQuestionStatus("answered")).toBe(false);
  });
});

describe("isRegQuestionLinkType", () => {
  it("accepts every link type", () => {
    for (const t of ["workspace_control", "control_test", "control_change", "incident", "readiness_assessment", "pra_assessment", "evidence"]) {
      expect(isRegQuestionLinkType(t)).toBe(true);
    }
  });

  it("rejects an unknown link type, including a plausible-sounding one not in the enum", () => {
    expect(isRegQuestionLinkType("enforcement_case")).toBe(false);
    expect(isRegQuestionLinkType("control")).toBe(false);
  });
});

describe("isRegCommitmentStatus", () => {
  it("accepts every status", () => {
    for (const s of ["open", "in_progress", "met", "missed", "withdrawn"]) expect(isRegCommitmentStatus(s)).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(isRegCommitmentStatus("done")).toBe(false);
  });
});

describe("isTerminalCommitmentStatus", () => {
  it("is true for met, missed, withdrawn", () => {
    expect(isTerminalCommitmentStatus("met")).toBe(true);
    expect(isTerminalCommitmentStatus("missed")).toBe(true);
    expect(isTerminalCommitmentStatus("withdrawn")).toBe(true);
  });

  it("is false for open and in_progress", () => {
    expect(isTerminalCommitmentStatus("open")).toBe(false);
    expect(isTerminalCommitmentStatus("in_progress")).toBe(false);
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

describe("parsePosition", () => {
  it("accepts positive integers", () => {
    expect(parsePosition(1)).toEqual({ ok: true, value: 1 });
    expect(parsePosition(42)).toEqual({ ok: true, value: 42 });
  });

  it("rejects 0, negatives, non-integers, and non-numbers", () => {
    expect(parsePosition(0)).toEqual({ ok: false });
    expect(parsePosition(-1)).toEqual({ ok: false });
    expect(parsePosition(1.5)).toEqual({ ok: false });
    expect(parsePosition("1")).toEqual({ ok: false });
    expect(parsePosition(undefined)).toEqual({ ok: false });
  });
});
