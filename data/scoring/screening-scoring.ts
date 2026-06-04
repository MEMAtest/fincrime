import type { ScreeningControl, ScreeningCategory, ScreeningTrigger } from "../screening/types";
import type { FirmType } from "../typologies/types";
import { allScreeningControls } from "../screening";

export interface ScreeningAnswers {
  firmType: FirmType;
  category: ScreeningCategory;
  trigger: ScreeningTrigger;
}

export interface ScreeningScore {
  control: ScreeningControl;
  score: number;
  breakdown: {
    categoryScore: number;
    firmTypeScore: number;
    triggerScore: number;
  };
}

const WEIGHTS = {
  category: 50,
  firmType: 25,
  trigger: 25,
} as const;

export function scoreScreeningControls(answers: ScreeningAnswers): ScreeningScore[] {
  return allScreeningControls
    .map((control) => {
      const categoryScore = control.category === answers.category ? WEIGHTS.category : 0;
      const firmTypeScore = control.applicableFirmTypes.includes(answers.firmType)
        ? WEIGHTS.firmType
        : 0;
      const triggerScore = control.applicableTriggers.includes(answers.trigger)
        ? WEIGHTS.trigger
        : 0;
      return {
        control,
        score: categoryScore + firmTypeScore + triggerScore,
        breakdown: { categoryScore, firmTypeScore, triggerScore },
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function getBestScreeningMatch(answers: ScreeningAnswers): ScreeningScore {
  return scoreScreeningControls(answers)[0];
}

export function getTopScreeningMatches(answers: ScreeningAnswers, count = 3): ScreeningScore[] {
  return scoreScreeningControls(answers).slice(0, count);
}
