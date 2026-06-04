import type { MaturityFramework, ControlArea, MaturityLevel, RemediationAction } from "../maturity/types";
import { MATURITY_ORDER, MATURITY_POINTS } from "../maturity/types";
import { getFrameworkByArea } from "../maturity";

export interface MaturityAnswers {
  area: ControlArea;
  currentLevel: MaturityLevel;
  targetLevel: MaturityLevel;
}

export interface MaturityResult {
  framework: MaturityFramework;
  currentLevel: MaturityLevel;
  targetLevel: MaturityLevel;
  currentScore: number; // 0–100
  targetScore: number;
  gapScore: number; // target - current (>=0)
  gapLevels: number; // number of levels to climb
  remediation: RemediationAction[]; // actions from current up to target-1
}

export function scoreMaturity(answers: MaturityAnswers): MaturityResult | null {
  const framework = getFrameworkByArea(answers.area);
  if (!framework) return null;

  const curOrder = MATURITY_ORDER[answers.currentLevel];
  const tgtOrder = MATURITY_ORDER[answers.targetLevel];
  const currentScore = MATURITY_POINTS[answers.currentLevel];
  const targetScore = MATURITY_POINTS[answers.targetLevel];

  const remediation = framework.remediation
    .filter((r) => {
      const o = MATURITY_ORDER[r.fromLevel];
      return o >= curOrder && o < tgtOrder;
    })
    .sort((a, b) => MATURITY_ORDER[a.fromLevel] - MATURITY_ORDER[b.fromLevel]);

  return {
    framework,
    currentLevel: answers.currentLevel,
    targetLevel: answers.targetLevel,
    currentScore,
    targetScore,
    gapScore: Math.max(0, targetScore - currentScore),
    gapLevels: Math.max(0, tgtOrder - curOrder),
    remediation,
  };
}
