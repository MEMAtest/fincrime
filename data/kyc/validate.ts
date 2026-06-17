import type { CddProfile } from "./types";

function isValidUrl(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Returns a list of citation gaps. The matrix's hard rule: every CddItem and
 * every EddTrigger must carry a non-empty `sources` with valid URLs, and every
 * profile must carry a `regulatoryBasis`.
 */
export function findCitationGaps(profiles: CddProfile[]): string[] {
  const errors: string[] = [];
  for (const p of profiles) {
    const id = `${p.entityType}/${p.jurisdiction}`;
    if (!p.regulatoryBasis || p.regulatoryBasis.length === 0) {
      errors.push(`${id}: profile has no regulatoryBasis`);
    }
    for (const s of p.sections) {
      for (const item of s.items) {
        if (!item.sources || item.sources.length === 0) {
          errors.push(`${id} [${s.key}] "${item.text}": missing regulatory reference`);
          continue;
        }
        for (const src of item.sources) {
          if (!isValidUrl(src.url)) errors.push(`${id} [${s.key}] "${item.text}": invalid source URL "${src.url}"`);
        }
      }
    }
    for (const t of p.eddTriggers) {
      if (!t.sources || t.sources.length === 0) {
        errors.push(`${id} EDD "${t.trigger}": missing regulatory reference`);
        continue;
      }
      for (const src of t.sources) {
        if (!isValidUrl(src.url)) errors.push(`${id} EDD "${t.trigger}": invalid source URL "${src.url}"`);
      }
    }
  }
  return errors;
}

/** Throws (failing the build) if any requirement lacks a stored regulatory reference. */
export function assertAllCited(profiles: CddProfile[]): void {
  const gaps = findCitationGaps(profiles);
  if (gaps.length > 0) {
    throw new Error(
      `KYC citation gate failed: ${gaps.length} requirement(s) lack a stored regulatory reference.\n` +
        gaps.slice(0, 25).join("\n")
    );
  }
}
