/**
 * Shared runtime validator for the `evidence` array every export payload in
 * app/api/export/pdf/route.ts carries (control change, control test,
 * incident, readiness, regulatory response) - extracted here so it is unit
 * testable in isolation (matching the lib/control-tests/validation.ts /
 * lib/incidents/validation.ts pattern) rather than living as five
 * structurally-identical private functions inside the route file.
 */

/** number, or null - never NaN/Infinity, never a stray string/object/array. */
export function isNumOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isFinite(v));
}

/** string, or null. */
export function isStrOrNull(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

/**
 * string, null, or undefined - for evidence.fileName, which is OPTIONAL:
 * JSON.stringify drops an `undefined` key entirely, and prod may not yet
 * have migration 009 (so e.file_name is undefined) or a browser may still
 * be holding a pre-migration JS bundle mid-deploy (same shape). A missing
 * key must never 400 a pack export that could export cleanly a minute
 * earlier - only a present-but-wrong-typed value should.
 */
export function isStrOrNullOrUndef(v: unknown): v is string | null | undefined {
  return v === undefined || isStrOrNull(v);
}

/** number, null, or undefined - see isStrOrNullOrUndef; fileSizeBytes is optional for the same reason. */
export function isNumOrNullOrUndef(v: unknown): v is number | null | undefined {
  return v === undefined || isNumOrNull(v);
}

/**
 * Validates one evidence array element as every *ExportEvidence type in
 * components/*\/types.ts shapes it: title/type are required strings,
 * description/linkUrl are required-but-nullable strings, and
 * fileName/fileSizeBytes are OPTIONAL (see isStrOrNullOrUndef above).
 */
export function isValidExportEvidence(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.title === "string" &&
    typeof e.type === "string" &&
    isStrOrNull(e.description) &&
    isStrOrNull(e.linkUrl) &&
    isStrOrNullOrUndef(e.fileName) &&
    isNumOrNullOrUndef(e.fileSizeBytes)
  );
}
