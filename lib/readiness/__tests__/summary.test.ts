import { describe, expect, it } from "vitest";
import { summarizeObligations, hasUnresolvedBlockers, isUnresolvedBlocker, type ObligationSummaryInput } from "../summary";

function ob(overrides: Partial<ObligationSummaryInput> = {}): ObligationSummaryInput {
  return { gap: "not_assessed", blocker: false, workspace_control_id: null, ...overrides };
}

describe("summarizeObligations", () => {
  it("returns a zeroed summary for an empty register", () => {
    expect(summarizeObligations([])).toEqual({
      total: 0,
      byGap: { not_assessed: 0, none: 0, partial: 0, full: 0 },
      blockerCount: 0,
      unresolvedBlockerCount: 0,
      noControlCount: 0,
      coveragePct: 0,
    });
  });

  it("counts obligations by gap", () => {
    const result = summarizeObligations([
      ob({ gap: "full" }),
      ob({ gap: "full" }),
      ob({ gap: "partial" }),
      ob({ gap: "none" }),
      ob({ gap: "not_assessed" }),
    ]);
    expect(result.total).toBe(5);
    expect(result.byGap).toEqual({ not_assessed: 1, none: 1, partial: 1, full: 2 });
  });

  it("computes coveragePct as the rounded percentage of gap = full", () => {
    // 1 of 3 full -> 33.33.. -> rounds to 33
    const result = summarizeObligations([ob({ gap: "full" }), ob({ gap: "none" }), ob({ gap: "partial" })]);
    expect(result.coveragePct).toBe(33);
  });

  it("computes 100% coverage when every obligation is full", () => {
    const result = summarizeObligations([ob({ gap: "full" }), ob({ gap: "full" })]);
    expect(result.coveragePct).toBe(100);
  });

  it("counts blockers and unresolved blockers separately - a blocker resolved to gap full is not unresolved", () => {
    const result = summarizeObligations([
      ob({ blocker: true, gap: "partial" }), // unresolved
      ob({ blocker: true, gap: "full" }), // resolved
      ob({ blocker: false, gap: "none" }), // not a blocker at all
    ]);
    expect(result.blockerCount).toBe(2);
    expect(result.unresolvedBlockerCount).toBe(1);
  });

  it("counts obligations with no control mapped", () => {
    const result = summarizeObligations([
      ob({ workspace_control_id: null }),
      ob({ workspace_control_id: "11111111-2222-3333-4444-555555555555" }),
      ob({ workspace_control_id: null }),
    ]);
    expect(result.noControlCount).toBe(2);
  });
});

describe("hasUnresolvedBlockers", () => {
  it("is false for an empty register", () => {
    expect(hasUnresolvedBlockers([])).toBe(false);
  });

  it("is false when no obligation is a blocker", () => {
    expect(hasUnresolvedBlockers([ob({ gap: "not_assessed" }), ob({ gap: "none" })])).toBe(false);
  });

  it("is true when a blocker's gap is anything other than full", () => {
    expect(hasUnresolvedBlockers([ob({ blocker: true, gap: "not_assessed" })])).toBe(true);
    expect(hasUnresolvedBlockers([ob({ blocker: true, gap: "none" })])).toBe(true);
    expect(hasUnresolvedBlockers([ob({ blocker: true, gap: "partial" })])).toBe(true);
  });

  it("is false when every blocker has been resolved to gap = full", () => {
    expect(hasUnresolvedBlockers([ob({ blocker: true, gap: "full" }), ob({ blocker: false, gap: "partial" })])).toBe(false);
  });
});

describe("isUnresolvedBlocker", () => {
  it("is the shared per-item predicate that hasUnresolvedBlockers/summarizeObligations and every UI filter (StepGaps, StepApproval) now consolidate on", () => {
    expect(isUnresolvedBlocker(ob({ blocker: true, gap: "partial" }))).toBe(true);
    expect(isUnresolvedBlocker(ob({ blocker: true, gap: "full" }))).toBe(false);
    expect(isUnresolvedBlocker(ob({ blocker: false, gap: "none" }))).toBe(false);
  });
});
