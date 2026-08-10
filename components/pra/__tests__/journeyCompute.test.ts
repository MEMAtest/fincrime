import { describe, expect, it } from "vitest";
import { opLoadInputFromControl } from "../journeyCompute";
import { DEFAULT_HOURLY_COST_GBP, scoreOperationalLoad } from "@/data/scoring/operational-load";
import type { AssessmentControlDTO } from "../types";

/**
 * Regression coverage for the must-fix defect: StepPack (step 8, the
 * committee pack) called opLoadInputFromControl(c) with NO second argument,
 * silently falling back to the hard-coded DEFAULT_HOURLY_COST_GBP even when
 * the workspace has its own defaultHourlyCostGbp set in Settings - so a
 * workspace on £100/hour saw £35/hour costed into the pack it approves.
 * StepGapsOpLoad (step 5) always threaded the workspace default through;
 * this proves opLoadInputFromControl itself behaves identically regardless
 * of which step calls it, so the same fix cannot silently regress in a
 * third call site.
 */
function makeControl(opLoad: Record<string, unknown>): AssessmentControlDTO {
  return {
    id: "control-1",
    workspace_id: "ws-1",
    assessment_id: "assessment-1",
    risk_id: "risk-1",
    workspace_control_id: null,
    control_slug: "some-control",
    coverage: "full",
    op_load: opLoad,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("opLoadInputFromControl", () => {
  it("falls back to the pure scoring module's DEFAULT_HOURLY_COST_GBP when no defaultHourlyCostGbp is supplied at all", () => {
    const input = opLoadInputFromControl(makeControl({ monthlyVolume: 1000, alertRatePct: 5, handlingMinutes: 10 }));
    expect(input.hourlyCostGbp).toBeUndefined();
    const result = scoreOperationalLoad(input);
    const expected = scoreOperationalLoad({ monthlyVolume: 1000, alertRatePct: 5, handlingMinutes: 10, hourlyCostGbp: DEFAULT_HOURLY_COST_GBP });
    expect(result.monthlyCostGbp).toBe(expected.monthlyCostGbp);
  });

  it("uses the workspace's defaultHourlyCostGbp when the control has no per-control override - the exact case StepPack was getting wrong", () => {
    const control = makeControl({ monthlyVolume: 1000, alertRatePct: 5, handlingMinutes: 10 });
    const input = opLoadInputFromControl(control, 100);
    expect(input.hourlyCostGbp).toBe(100);

    const at100 = scoreOperationalLoad(input);
    const at35 = scoreOperationalLoad(opLoadInputFromControl(control, undefined));
    // £100/hour must cost strictly more than the hard-coded £35/hour default
    // - proves the workspace setting is genuinely driving the number, not
    // being silently ignored.
    expect(at100.monthlyCostGbp).toBeGreaterThan(at35.monthlyCostGbp);
  });

  it("a per-control hourlyCostGbp override still wins over the workspace default", () => {
    const control = makeControl({ monthlyVolume: 1000, alertRatePct: 5, handlingMinutes: 10, hourlyCostGbp: 60 });
    const input = opLoadInputFromControl(control, 100);
    expect(input.hourlyCostGbp).toBe(60);
  });

  it("clamps missing/non-numeric op_load fields to 0 rather than throwing", () => {
    const input = opLoadInputFromControl(makeControl({}), 100);
    expect(input.monthlyVolume).toBe(0);
    expect(input.alertRatePct).toBe(0);
    expect(input.handlingMinutes).toBe(0);
    expect(input.hourlyCostGbp).toBe(100);
  });
});
