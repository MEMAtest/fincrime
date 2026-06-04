import { screeningControls } from "./controls";
import type { ScreeningControl } from "./types";

export const allScreeningControls: ScreeningControl[] = screeningControls;

export function getScreeningBySlug(slug: string): ScreeningControl | undefined {
  return allScreeningControls.find((c) => c.slug === slug);
}

export function getScreeningById(id: number): ScreeningControl | undefined {
  return allScreeningControls.find((c) => c.id === id);
}

export type { ScreeningControl } from "./types";
export {
  SCREENING_CATEGORY_LABEL,
  SCREENING_TRIGGER_LABEL,
} from "./types";
export type { ScreeningCategory, ScreeningTrigger } from "./types";
