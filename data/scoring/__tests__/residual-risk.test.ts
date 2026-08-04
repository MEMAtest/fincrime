import { describe, expect, it } from "vitest";
import {
  scoreResidualRisk,
  summariseResidualRisk,
  compareToAppetite,
  DEFAULT_APPETITE_THRESHOLDS,
  type ResidualRiskResult,
} from "../residual-risk";
import { getRiskRating } from "../risk-matrix";

describe("scoreResidualRisk", () => {
  it("returns residual equal to inherent when there are zero controls", () => {
    const result = scoreResidualRisk({ inherentScore: 70, controls: [] });
    expect(result.residualScore).toBe(70);
    expect(result.mitigationApplied).toBe(0);
    expect(result.residualRating).toBe(getRiskRating(70).rating);
  });

  it("one full-coverage, strong-effectiveness control reduces the risk band", () => {
    const inherent = scoreResidualRisk({ inherentScore: 80, controls: [] });
    expect(inherent.residualRating).toBe("critical");

    const result = scoreResidualRisk({
      inherentScore: 80,
      controls: [{ coverage: "full", effectiveness: "strong" }],
    });

    // retention = 1 - 0.70 = 0.30; residual = 80 * 0.30 = 24
    expect(result.residualScore).toBe(24);
    expect(result.mitigationApplied).toBe(70);
    expect(result.residualRating).toBe("low");
    expect(result.residualRating).not.toBe(inherent.residualRating);
  });

  it("gap-only controls apply no mitigation regardless of claimed effectiveness", () => {
    const result = scoreResidualRisk({
      inherentScore: 55,
      controls: [
        { coverage: "gap", effectiveness: "strong" },
        { coverage: "gap", effectiveness: "adequate" },
      ],
    });
    expect(result.residualScore).toBe(55);
    expect(result.mitigationApplied).toBe(0);
  });

  it("not_assessed effectiveness applies no mitigation even with full coverage", () => {
    const result = scoreResidualRisk({
      inherentScore: 55,
      controls: [{ coverage: "full", effectiveness: "not_assessed" }],
    });
    expect(result.residualScore).toBe(55);
    expect(result.mitigationApplied).toBe(0);
  });

  it("combines multiple controls with diminishing returns, not simple addition", () => {
    // A single strong control alone.
    const single = scoreResidualRisk({
      inherentScore: 100,
      controls: [{ coverage: "full", effectiveness: "strong" }],
    });
    expect(single.residualScore).toBe(30); // 100 * (1 - 0.70)

    // Adding a second (weaker) control still helps, but nowhere near the
    // ~120% combined mitigation simple addition (0.70 + 0.50) would imply.
    const combined = scoreResidualRisk({
      inherentScore: 100,
      controls: [
        { coverage: "full", effectiveness: "strong" },
        { coverage: "full", effectiveness: "adequate" },
      ],
    });
    // retention = (1 - 0.70) * (1 - 0.50) = 0.15; residual = 100 * 0.15 = 15
    expect(combined.residualScore).toBe(15);
    expect(combined.residualScore).toBeLessThan(single.residualScore);
    expect(combined.residualScore).toBeGreaterThan(0);
  });

  it("respects the residual floor: stacking strong controls never reaches zero", () => {
    const result = scoreResidualRisk({
      inherentScore: 100,
      controls: [
        { coverage: "full", effectiveness: "strong" },
        { coverage: "full", effectiveness: "strong" },
        { coverage: "full", effectiveness: "strong" },
      ],
    });
    // raw retention = 0.30^3 = 0.027 -> raw residual = 2.7, floored to 5
    expect(result.residualScore).toBe(5);
    expect(result.residualScore).toBeGreaterThan(0);

    const evenMoreControls = scoreResidualRisk({
      inherentScore: 100,
      controls: [
        { coverage: "full", effectiveness: "strong" },
        { coverage: "full", effectiveness: "strong" },
        { coverage: "full", effectiveness: "strong" },
        { coverage: "full", effectiveness: "strong" },
        { coverage: "full", effectiveness: "strong" },
      ],
    });
    expect(evenMoreControls.residualScore).toBe(5);
  });

  it("never lets the floor push residual above inherent for a low inherent score", () => {
    const result = scoreResidualRisk({
      inherentScore: 3,
      controls: [{ coverage: "full", effectiveness: "strong" }],
    });
    expect(result.residualScore).toBeLessThanOrEqual(3);
  });

  it("clamps out-of-range inherent scores", () => {
    expect(scoreResidualRisk({ inherentScore: 150, controls: [] }).residualScore).toBe(100);
    expect(scoreResidualRisk({ inherentScore: -20, controls: [] }).residualScore).toBe(0);
    expect(scoreResidualRisk({ inherentScore: Number.NaN, controls: [] }).residualScore).toBe(0);
  });
});

describe("compareToAppetite", () => {
  it("treats scores below toleratedFrom as within appetite", () => {
    expect(compareToAppetite(DEFAULT_APPETITE_THRESHOLDS.toleratedFrom - 0.01)).toBe("within");
  });

  it("treats the toleratedFrom boundary itself as tolerated", () => {
    expect(compareToAppetite(DEFAULT_APPETITE_THRESHOLDS.toleratedFrom)).toBe("tolerated");
  });

  it("treats scores just below outsideFrom as tolerated", () => {
    expect(compareToAppetite(DEFAULT_APPETITE_THRESHOLDS.outsideFrom - 0.01)).toBe("tolerated");
  });

  it("treats the outsideFrom boundary itself as outside", () => {
    expect(compareToAppetite(DEFAULT_APPETITE_THRESHOLDS.outsideFrom)).toBe("outside");
  });

  it("supports workspace-overridden thresholds", () => {
    const custom = { toleratedFrom: 20, outsideFrom: 30 };
    expect(compareToAppetite(25, custom)).toBe("tolerated");
    expect(compareToAppetite(35, custom)).toBe("outside");
    expect(compareToAppetite(10, custom)).toBe("within");
  });
});

describe("summariseResidualRisk", () => {
  it("returns null for an empty risk list", () => {
    expect(summariseResidualRisk([])).toBeNull();
  });

  it("takes the max residual as overall, and reports the mean for context", () => {
    const risks: ResidualRiskResult[] = [
      scoreResidualRisk({ inherentScore: 20, controls: [] }),
      scoreResidualRisk({ inherentScore: 80, controls: [] }),
      scoreResidualRisk({ inherentScore: 50, controls: [] }),
    ];
    const summary = summariseResidualRisk(risks);
    expect(summary).not.toBeNull();
    expect(summary?.overallResidualScore).toBe(80);
    expect(summary?.meanResidualScore).toBeCloseTo(50, 5);
    expect(summary?.overallResidualRating).toBe(getRiskRating(80).rating);
    expect(summary?.appetiteResult).toBe("outside");
  });
});
