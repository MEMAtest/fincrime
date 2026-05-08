import { typology01 } from "./typology-01";
import { typology02 } from "./typology-02";
import { typology03 } from "./typology-03";
import { typology04 } from "./typology-04";
import { typology05 } from "./typology-05";
import { typology06 } from "./typology-06";
import { typology07 } from "./typology-07";
import { typology08 } from "./typology-08";
import { typology09 } from "./typology-09";
import { typology10 } from "./typology-10";
import type { Typology } from "./types";

export const allTypologies: Typology[] = [
  typology01,
  typology02,
  typology03,
  typology04,
  typology05,
  typology06,
  typology07,
  typology08,
  typology09,
  typology10,
];

export function getTypologyBySlug(slug: string): Typology | undefined {
  return allTypologies.find((t) => t.slug === slug);
}

export function getTypologyById(id: number): Typology | undefined {
  return allTypologies.find((t) => t.id === id);
}

export type { Typology } from "./types";
export type {
  FirmType,
  ProductType,
  CustomerType,
  RiskTheme,
  Source,
  DetectionRule,
  WorkflowStep,
  GovernanceItem,
  Metric,
} from "./types";
