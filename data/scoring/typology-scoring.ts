import type { Typology, FirmType, ProductType, CustomerType, RiskTheme } from "../typologies/types";
import { allTypologies } from "../typologies";

export interface TypologyAnswers {
  firmTypes: FirmType[];
  products: ProductType[];
  customerTypes: CustomerType[];
  riskThemes: RiskTheme[];
}

/**
 * Accept singular or plural fields (API bodies, older deep links, the
 * firm-research handoff) and normalise to the multi-select array shape.
 */
export function normalizeAnswers(input: {
  firmType?: FirmType | null;
  firmTypes?: FirmType[];
  product?: ProductType | null;
  products?: ProductType[];
  customerType?: CustomerType | null;
  customerTypes?: CustomerType[];
  riskTheme?: RiskTheme | null;
  riskThemes?: RiskTheme[];
}): TypologyAnswers {
  const toArr = <T>(plural: T[] | undefined, single: T | null | undefined): T[] =>
    Array.isArray(plural) && plural.length > 0 ? plural : single ? [single] : [];
  return {
    firmTypes: toArr(input.firmTypes, input.firmType),
    products: toArr(input.products, input.product),
    customerTypes: toArr(input.customerTypes, input.customerType),
    riskThemes: toArr(input.riskThemes, input.riskTheme),
  };
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
  const firmTypes = answers.firmTypes ?? [];
  const products = answers.products ?? [];
  const customerTypes = answers.customerTypes ?? [];
  const themes = answers.riskThemes ?? [];

  // A typology is relevant on a dimension when ANY selected value is in scope.
  // Award the full weight on a match (no dilution); broadening the selection
  // surfaces more relevant typologies rather than penalising each match.
  return allTypologies
    .map((typology) => {
      const firmTypeScore = typology.applicableFirmTypes.some((f) => firmTypes.includes(f))
        ? WEIGHTS.firmType
        : 0;

      const productScore = typology.applicableProducts.some((p) => products.includes(p))
        ? WEIGHTS.product
        : 0;

      const customerTypeScore = typology.applicableCustomerTypes.some((c) => customerTypes.includes(c))
        ? WEIGHTS.customerType
        : 0;

      const riskThemeScore = themes.includes(typology.riskTheme) ? WEIGHTS.riskTheme : 0;

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
