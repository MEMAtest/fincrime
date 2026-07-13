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
import { typology11 } from "./typology-11";
import { typology12 } from "./typology-12";
import { typology13 } from "./typology-13";
import { typology14 } from "./typology-14";
import { typology15 } from "./typology-15";
import { typology16 } from "./typology-16";
import { typology17 } from "./typology-17";
import { typology18 } from "./typology-18";
import { typology19 } from "./typology-19";
import { typology20 } from "./typology-20";
import { typology21 } from "./typology-21";
import { typology22 } from "./typology-22";
import { typology23 } from "./typology-23";
import { typology24 } from "./typology-24";
import { typology25 } from "./typology-25";
import { typology26 } from "./typology-26";
import { typology27 } from "./typology-27";
import { typology28 } from "./typology-28";
import { typology29 } from "./typology-29";
import { typology30 } from "./typology-30";
import { typology31 } from "./typology-31";
import { typology32 } from "./typology-32";
import { typology33 } from "./typology-33";
import { typology34 } from "./typology-34";
import { typology35 } from "./typology-35";
import { typology36 } from "./typology-36";
import { typology37 } from "./typology-37";
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
  typology11,
  typology12,
  typology13,
  typology14,
  typology15,
  typology16,
  typology17,
  typology18,
  typology19,
  typology20,
  typology21,
  typology22,
  typology23,
  typology24,
  typology25,
  typology26,
  typology27,
  typology28,
  typology29,
  typology30,
  typology31,
  typology32,
  typology33,
  typology34,
  typology35,
  typology36,
  typology37,
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
