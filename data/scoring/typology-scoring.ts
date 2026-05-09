import type { Typology, FirmType, ProductType, CustomerType, RiskTheme } from "../typologies/types";
import { allTypologies } from "../typologies";

export interface TypologyAnswers {
  firmType: FirmType;
  product: ProductType;
  customerType: CustomerType;
  riskThemes: RiskTheme[];
}

export interface TypologyScore {
  typology: Typology;
  score: number;
  breakdown: {
    firmTypeScore: number;
    productScore: number;
    customerTypeScore: number;
    riskThemeScore: number;
  };
}

const WEIGHTS = {
  firmType: 30,
  product: 25,
  customerType: 20,
  riskTheme: 25,
} as const;

export function scoreTypologies(answers: TypologyAnswers): TypologyScore[] {
  const themes = answers.riskThemes ?? [];
  return allTypologies
    .map((typology) => {
      const firmTypeScore = typology.applicableFirmTypes.includes(answers.firmType)
        ? WEIGHTS.firmType
        : 0;

      const productScore = typology.applicableProducts.includes(answers.product)
        ? WEIGHTS.product
        : 0;

      const customerTypeScore = typology.applicableCustomerTypes.includes(answers.customerType)
        ? WEIGHTS.customerType
        : 0;

      const riskThemeScore = themes.length > 0 && themes.includes(typology.riskTheme)
        ? Math.round(WEIGHTS.riskTheme / themes.length)
        : 0;

      const score = firmTypeScore + productScore + customerTypeScore + riskThemeScore;

      return {
        typology,
        score,
        breakdown: {
          firmTypeScore,
          productScore,
          customerTypeScore,
          riskThemeScore,
        },
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function getBestMatch(answers: TypologyAnswers): TypologyScore {
  const scores = scoreTypologies(answers);
  return scores[0];
}

export function getTopMatches(answers: TypologyAnswers, count = 3): TypologyScore[] {
  return scoreTypologies(answers).slice(0, count);
}

export function getRelatedTypologies(
  answers: TypologyAnswers,
  bestSlug: string,
  count = 4
): TypologyScore[] {
  const themes = answers.riskThemes ?? [];
  return scoreTypologies(answers)
    .filter((m) => m.typology.slug !== bestSlug && themes.includes(m.typology.riskTheme))
    .slice(0, count);
}
