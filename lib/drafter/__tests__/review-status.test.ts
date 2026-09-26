import { describe, it, expect } from "vitest";
import { combineStatus } from "../review-status";
import type { JudgeResult } from "../judge";

const goodJudge: JudgeResult = {
  overall: "pass",
  modelName: "stub",
  promptVersion: "v1",
  criteria: {
    a: { quote: "x", pass: true, reason: "", suggestedRewrite: null },
  },
};

describe("combineStatus", () => {
  it("is critical when lint has a critical issue, regardless of judge", () => {
    const status = combineStatus({
      lintIssues: [{ rule: "dash", severity: "critical", message: "x" }],
      judge: goodJudge,
      judgeStale: false,
    });
    expect(status).toBe("critical");
  });

  it("is not_reviewed when there is no judge yet, even with clean lint", () => {
    expect(combineStatus({ lintIssues: [], judge: null, judgeStale: false })).toBe("not_reviewed");
  });

  it("is not_reviewed when the judge result is stale", () => {
    expect(combineStatus({ lintIssues: [], judge: goodJudge, judgeStale: true })).toBe("not_reviewed");
  });

  it("is not_reviewed when the judge output was invalid", () => {
    expect(combineStatus({ lintIssues: [], judge: { error: "bad", invalid: true }, judgeStale: false })).toBe("not_reviewed");
  });

  it("is critical when the judge's overall verdict is fail", () => {
    const failing: JudgeResult = { ...goodJudge, overall: "fail" };
    expect(combineStatus({ lintIssues: [], judge: failing, judgeStale: false })).toBe("critical");
  });

  it("is pass only when lint is clean, judge is fresh, and every criterion passed", () => {
    expect(combineStatus({ lintIssues: [], judge: goodJudge, judgeStale: false })).toBe("pass");
  });

  it("is minor when judge passed overall but a non-critical criterion failed", () => {
    const minor: JudgeResult = {
      ...goodJudge,
      criteria: { ...goodJudge.criteria, b: { quote: "y", pass: false, reason: "", suggestedRewrite: "z" } },
    };
    expect(combineStatus({ lintIssues: [], judge: minor, judgeStale: false })).toBe("minor");
  });

  it("is minor when lint has only warnings and judge passed cleanly", () => {
    expect(
      combineStatus({ lintIssues: [{ rule: "dash", severity: "warning", message: "x" }], judge: goodJudge, judgeStale: false })
    ).toBe("minor");
  });

  it("is needs_input when needsInput is set, even with a critical lint issue or a failing judge (prod walkthrough item 3: a placeholder must never be labelled critical)", () => {
    expect(
      combineStatus({
        lintIssues: [{ rule: "unfilled_placeholder", severity: "critical", message: "x" }],
        judge: { ...goodJudge, overall: "fail" },
        judgeStale: false,
        needsInput: true,
      })
    ).toBe("needs_input");
  });

  it("is never pass when needsInput is set, even with clean lint and a passing judge", () => {
    expect(combineStatus({ lintIssues: [], judge: goodJudge, judgeStale: false, needsInput: true })).toBe("needs_input");
  });
});
