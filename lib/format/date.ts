/**
 * Shared ISO-date display formatter. Postgres returns DATE columns as bare
 * `YYYY-MM-DD` strings; `new Date("2026-08-09").toLocaleDateString()`
 * parses that as UTC midnight and then renders it in the CALLER's local
 * timezone, which reads as the day before for anyone west of UTC (most of
 * the Americas). This is a house-wide pattern (lib/pdf/readiness-pdf.ts,
 * components/readiness/StepApproval.tsx and
 * app/assure/market-readiness/page.tsx all independently re-implemented a
 * fmtDate with this bug) - pinning `timeZone: "UTC"` here makes the
 * displayed calendar date match the one actually stored, regardless of the
 * viewer's local offset, and gives every caller one place to fix it.
 *
 * `style: "long"` renders "9 Aug 2026" (the on-screen UI convention);
 * `style: "numeric"` (the default) renders "09/08/2026" (the PDF pack
 * convention, matching the other lib/pdf/*.ts generators' fmtDate output).
 */
export function formatIsoDate(value: unknown, options?: { fallback?: string; style?: "numeric" | "long" }): string {
  const fallback = options?.fallback ?? "Not set";
  if (typeof value !== "string" || !value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  if ((options?.style ?? "numeric") === "long") {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  return d.toLocaleDateString("en-GB", { timeZone: "UTC" });
}
