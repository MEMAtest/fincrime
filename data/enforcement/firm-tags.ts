import type { FirmType } from "../typologies/types";

/**
 * Hand-authored firm-type tags for real enforcement cases, kept in a SIDECAR so
 * the generated `cases.ts` is never hand-edited. Joined to a case by `firm` (or
 * an alias) + `year` in `lib/enforcement/select.ts`, the same pattern as
 * `lessons.ts`. The generator tags only a subset of cases (mostly banks); this
 * fills obvious gaps so the firm-profile dashboards show honest per-firm-type
 * enforcement. Individuals and firms with no clean FirmType (claims managers,
 * credit reference agencies, listed non-financials) are deliberately left out.
 */
export interface FirmTypeTag {
  firm: string;
  year: number;
  /** Alternate spellings used in the dataset. */
  aliases?: string[];
  firmTypes: FirmType[];
}

export const FIRM_TYPE_TAGS: FirmTypeTag[] = [
  { firm: "National Westminster Bank Plc", year: 2021, aliases: ["NatWest", "National Westminster Bank"], firmTypes: ["bank"] },
  { firm: "Santander plc", year: 2014, firmTypes: ["bank"] },
  { firm: "Standard Bank PLC", year: 2014, firmTypes: ["bank"] },
  { firm: "EFG Private Bank", year: 2013, firmTypes: ["bank", "wealth_manager"] },
  { firm: "Credit Suisse International", year: 2014, firmTypes: ["bank"] },
  { firm: "Guaranty Trust Bank (UK) Limited", year: 2013, aliases: ["Guaranty Trust Bank (UK) Limited (GT Bank)"], firmTypes: ["bank"] },
  { firm: "Yorkshire Building Society", year: 2014, firmTypes: ["bank"] },
  { firm: "Bastion Capital London Limited", year: 2023, firmTypes: ["wealth_manager"] },
  { firm: "The TJM Partnership Limited (Formerly known as Neovision Global Capital Limited) (In Liquidation)", year: 2022, aliases: ["The TJM Partnership Limited", "TJM Partnership"], firmTypes: ["wealth_manager"] },
  { firm: "Mako Financial Markets Partnership LLP", year: 2025, firmTypes: ["wealth_manager"] },
  { firm: "Sunrise Brokers LLP", year: 2021, firmTypes: ["wealth_manager"] },
  { firm: "Arian Financial LLP", year: 2025, firmTypes: ["wealth_manager"] },
  { firm: "Sapien Capital Limited", year: 2021, firmTypes: ["wealth_manager"] },
  // App-only digital banks: the dataset classifies them as "bank"; add the
  // neobank lens so the digital-bank archetype shows its own enforcement. These
  // merge with the existing "bank" tag rather than replacing it.
  { firm: "Starling Bank Limited", year: 2024, aliases: ["Starling Bank", "Starling"], firmTypes: ["neobank"] },
  { firm: "Monzo", year: 2024, aliases: ["Monzo Bank", "Monzo Bank Limited"], firmTypes: ["neobank"] },
];

const tagIndex: Record<string, FirmType[]> = {};
for (const t of FIRM_TYPE_TAGS) {
  tagIndex[`${t.firm.trim().toLowerCase()}|${t.year}`] = t.firmTypes;
  for (const a of t.aliases ?? []) tagIndex[`${a.trim().toLowerCase()}|${t.year}`] = t.firmTypes;
}

/** Sidecar firm-type tags for a case, or an empty array when none exist. */
export function firmTypeTagsFor(firm: string, year: number): FirmType[] {
  return tagIndex[`${firm.trim().toLowerCase()}|${year}`] ?? [];
}
