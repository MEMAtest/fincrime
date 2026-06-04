import { maturityFrameworks } from "./frameworks";
import type { MaturityFramework, ControlArea } from "./types";

export const allMaturityFrameworks: MaturityFramework[] = maturityFrameworks;

export function getFrameworkByArea(area: ControlArea): MaturityFramework | undefined {
  return allMaturityFrameworks.find((f) => f.area === area);
}

export function getFrameworkBySlug(slug: string): MaturityFramework | undefined {
  return allMaturityFrameworks.find((f) => f.slug === slug);
}

export type { MaturityFramework } from "./types";
export {
  CONTROL_AREA_LABEL,
  MATURITY_LABEL,
  MATURITY_ORDER,
  MATURITY_POINTS,
} from "./types";
export type { ControlArea, MaturityLevel } from "./types";
