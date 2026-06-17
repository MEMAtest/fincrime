import type { CddProfile, EntityType, Jurisdiction } from "./types";
import { ENTITY_ORDER } from "./types";
import { assertAllCited } from "./validate";
import { individual } from "./profiles/individual";
import { corporate } from "./profiles/corporate";
import { charity } from "./profiles/charity";
import { regulatedEntity } from "./profiles/regulated_entity";
import { listedEntity } from "./profiles/listed_entity";
import { trust } from "./profiles/trust";
import { partnership } from "./profiles/partnership";
import { soleTrader } from "./profiles/sole_trader";
import { fund } from "./profiles/fund";
import { government } from "./profiles/government";
import { limitedPartnership } from "./profiles/limited_partnership";
import { foundation } from "./profiles/foundation";
import { swf } from "./profiles/swf";
import { stak } from "./profiles/stak";
import { spv } from "./profiles/spv";
import { tcspClient } from "./profiles/tcsp_client";
import { tcspPartner } from "./profiles/tcsp_partner";
import { introductoryBroker } from "./profiles/introductory_broker";
import { programManager } from "./profiles/program_manager";

export const allCddProfiles: CddProfile[] = [
  ...individual,
  ...corporate,
  ...charity,
  ...regulatedEntity,
  ...listedEntity,
  ...trust,
  ...partnership,
  ...soleTrader,
  ...fund,
  ...government,
  ...limitedPartnership,
  ...foundation,
  ...swf,
  ...stak,
  ...spv,
  ...tcspClient,
  ...tcspPartner,
  ...introductoryBroker,
  ...programManager,
];

// Citation gate: fail fast at module load if any requirement is missing its
// stored regulatory reference. This runs during the Next build.
assertAllCited(allCddProfiles);

// O(1) lookup index, built once at module load.
const keyOf = (entityType: EntityType, jurisdiction: Jurisdiction) => `${entityType}|${jurisdiction}`;
const profileIndex = new Map<string, CddProfile>(allCddProfiles.map((p) => [keyOf(p.entityType, p.jurisdiction), p]));

export interface ProfileLookup {
  profile: CddProfile;
  /** True when the exact (entity x jurisdiction) cell was not authored and the
   *  FATF/global baseline is shown instead. */
  fallback: boolean;
}

/** Entity types that have at least one authored profile, in display order. */
export function entityTypesCovered(): EntityType[] {
  const present = new Set(allCddProfiles.map((p) => p.entityType));
  return ENTITY_ORDER.filter((e) => present.has(e));
}

/** Exact (entity x jurisdiction) profile, or the FATF/global baseline as a flagged fallback. */
export function getCddProfile(entityType: EntityType, jurisdiction: Jurisdiction): ProfileLookup | null {
  const exact = profileIndex.get(keyOf(entityType, jurisdiction));
  if (exact) return { profile: exact, fallback: false };
  const base = profileIndex.get(keyOf(entityType, "global"));
  if (base) return { profile: base, fallback: jurisdiction !== "global" };
  return null;
}

/** Jurisdictions with an authored (non-fallback) profile for an entity type. */
export function jurisdictionsFor(entityType: EntityType): Jurisdiction[] {
  return allCddProfiles.filter((p) => p.entityType === entityType).map((p) => p.jurisdiction);
}

/** For a jurisdiction, the profile (exact or FATF fallback) for every covered entity type. */
export function listProfiles(jurisdiction: Jurisdiction): ProfileLookup[] {
  return entityTypesCovered()
    .map((e) => getCddProfile(e, jurisdiction))
    .filter((x): x is ProfileLookup => x !== null);
}

export type { CddProfile } from "./types";
