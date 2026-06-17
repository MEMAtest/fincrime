/**
 * One codec for comma-separated list params / fields, shared by the URL readers
 * (TypologyIQ wizard + results, KYC matrix) and the API routes (export, narrative).
 * Keeping this in one place stops the on-screen view, the PDF and the AI prose
 * from drifting when they decode the same query string.
 */

/** Split a comma string into trimmed, non-empty, de-duplicated tokens. */
export function splitCsv(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const v of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Parse a CSV param, optionally validating against an allow-list (so junk values
 * are dropped rather than rendered/crashing) and applying a fallback when empty.
 */
export function parseListParam(
  raw: string | null | undefined,
  opts?: { allow?: Iterable<string>; fallback?: string[] }
): string[] {
  let out = splitCsv(raw);
  if (opts?.allow) {
    const allow = opts.allow instanceof Set ? opts.allow : new Set(opts.allow);
    out = out.filter((v) => allow.has(v));
  }
  return out.length || !opts?.fallback ? out : opts.fallback;
}

/** Coalesce a plural array OR a singular/CSV string into trimmed, de-duped tokens. */
export function coerceList(plural: unknown, single: unknown): string[] {
  if (Array.isArray(plural)) return splitCsv(plural.map((x) => String(x)).join(","));
  if (typeof single === "string") return splitCsv(single);
  return [];
}
