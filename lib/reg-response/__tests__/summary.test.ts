import { describe, expect, it } from "vitest";
import {
  summarizeQuestions,
  summarizeCommitments,
  isOverdueCommitment,
  daysUntilDeadline,
  regResponseSummary,
  type QuestionSummaryInput,
  type CommitmentSummaryInput,
} from "../summary";

const ASOF = new Date("2026-08-10T12:00:00.000Z");

function q(status: QuestionSummaryInput["status"]): QuestionSummaryInput {
  return { status };
}

function c(overrides: Partial<CommitmentSummaryInput> = {}): CommitmentSummaryInput {
  return { status: "open", due_date: null, ...overrides };
}

describe("summarizeQuestions", () => {
  it("returns a zeroed summary for no questions", () => {
    expect(summarizeQuestions([])).toEqual({
      totalQuestions: 0,
      questionsByStatus: { unanswered: 0, drafted: 0, reviewed: 0 },
      answeredCount: 0,
      unansweredCount: 0,
      answeredPct: 0,
    });
  });

  it("counts questions by status and computes answeredPct as drafted+reviewed over total", () => {
    const result = summarizeQuestions([q("unanswered"), q("drafted"), q("reviewed"), q("reviewed")]);
    expect(result.totalQuestions).toBe(4);
    expect(result.questionsByStatus).toEqual({ unanswered: 1, drafted: 1, reviewed: 2 });
    expect(result.unansweredCount).toBe(1);
    expect(result.answeredCount).toBe(3);
    expect(result.answeredPct).toBe(75);
  });

  it("rounds answeredPct", () => {
    // 1 of 3 answered -> 33.33.. -> rounds to 33
    const result = summarizeQuestions([q("drafted"), q("unanswered"), q("unanswered")]);
    expect(result.answeredPct).toBe(33);
  });

  it("is 100% answered when every question is drafted or reviewed", () => {
    expect(summarizeQuestions([q("drafted"), q("reviewed")]).answeredPct).toBe(100);
  });
});

describe("isOverdueCommitment", () => {
  it("is false for a commitment with no due date", () => {
    expect(isOverdueCommitment(c({ due_date: null }), ASOF)).toBe(false);
  });

  it("is true for a non-terminal commitment whose due date (ISO string) has passed", () => {
    expect(isOverdueCommitment(c({ status: "open", due_date: "2026-01-01" }), ASOF)).toBe(true);
  });

  it("is true for a non-terminal commitment whose due date (a JS Date, as the pg driver actually returns for a DATE column) has passed", () => {
    expect(isOverdueCommitment(c({ status: "in_progress", due_date: new Date("2026-01-01T00:00:00.000Z") }), ASOF)).toBe(true);
  });

  it("is false for a commitment due in the future", () => {
    expect(isOverdueCommitment(c({ status: "open", due_date: "2027-01-01" }), ASOF)).toBe(false);
  });

  it("is false the day of the due date (only strictly past days count as overdue)", () => {
    expect(isOverdueCommitment(c({ status: "open", due_date: "2026-08-10" }), ASOF)).toBe(false);
  });

  it("is false once terminal, even with a due date in the past - met/missed/withdrawn are never overdue", () => {
    expect(isOverdueCommitment(c({ status: "met", due_date: "2026-01-01" }), ASOF)).toBe(false);
    expect(isOverdueCommitment(c({ status: "missed", due_date: "2026-01-01" }), ASOF)).toBe(false);
    expect(isOverdueCommitment(c({ status: "withdrawn", due_date: "2026-01-01" }), ASOF)).toBe(false);
  });
});

describe("summarizeCommitments", () => {
  it("returns a zeroed summary for no commitments", () => {
    expect(summarizeCommitments([], ASOF)).toEqual({
      totalCommitments: 0,
      commitmentsByStatus: { open: 0, in_progress: 0, met: 0, missed: 0, withdrawn: 0 },
      overdueCommitmentCount: 0,
    });
  });

  it("counts commitments by status and overdue count together", () => {
    const result = summarizeCommitments(
      [
        c({ status: "open", due_date: "2026-01-01" }), // overdue
        c({ status: "in_progress", due_date: "2027-01-01" }), // not overdue
        c({ status: "met", due_date: "2026-01-01" }), // terminal, not overdue
        c({ status: "missed" }),
        c({ status: "withdrawn" }),
      ],
      ASOF
    );
    expect(result.totalCommitments).toBe(5);
    expect(result.commitmentsByStatus).toEqual({ open: 1, in_progress: 1, met: 1, missed: 1, withdrawn: 1 });
    expect(result.overdueCommitmentCount).toBe(1);
  });
});

describe("daysUntilDeadline", () => {
  it("is null when there is no deadline", () => {
    expect(daysUntilDeadline(null, ASOF)).toBeNull();
  });

  it("is positive for a future deadline", () => {
    expect(daysUntilDeadline("2026-08-20", ASOF)).toBe(10);
  });

  it("is 0 for today", () => {
    expect(daysUntilDeadline("2026-08-10", ASOF)).toBe(0);
  });

  it("is negative once the deadline has passed", () => {
    expect(daysUntilDeadline("2026-08-01", ASOF)).toBe(-9);
  });

  it("handles a JS Date input (the pg driver's actual runtime type for a DATE column) the same as an ISO string", () => {
    expect(daysUntilDeadline(new Date("2026-08-20T00:00:00.000Z"), ASOF)).toBe(10);
  });
});

describe("regResponseSummary", () => {
  it("composes question and commitment summaries with the deadline countdown", () => {
    const result = regResponseSummary(
      [q("unanswered"), q("reviewed")],
      [c({ status: "open", due_date: "2026-01-01" })],
      "2026-09-01",
      ASOF
    );
    expect(result.totalQuestions).toBe(2);
    expect(result.unansweredCount).toBe(1);
    expect(result.answeredPct).toBe(50);
    expect(result.totalCommitments).toBe(1);
    expect(result.overdueCommitmentCount).toBe(1);
    expect(result.daysUntilDeadline).toBe(22);
  });
});
