/**
 * Money helpers for the PRA Drafter spend tracking (defect: "SPEND SHOWS
 * $0.00 after ~20 real calls").
 *
 * Root cause: `drafter_model_calls.cost_estimate_pence` and
 * `drafter_pras.spend_pence` were populated with `Math.round(costInCents)`.
 * A real OpenRouter call's cost is a small fraction of a single cent (e.g.
 * $0.0002), so `Math.round` truncated every individual call to 0 whole
 * cents - after 20 such calls the summed spend was still exactly 0, and the
 * UI (dividing by 100 and formatting to 2dp) always showed "$0.00" even
 * though real, non-zero money had been spent.
 *
 * Fix: both columns now store the amount in STORED UNITS = 1/10,000 of a
 * USD cent (so 1 USD = 1,000,000 stored units) instead of whole cents.
 * That is enough precision that a genuine sub-cent per-call cost still
 * rounds to a non-zero integer, while the column stays a plain INTEGER (no
 * migration to NUMERIC needed). `drafter_settings.cost_cap_pence_per_pra`
 * and `drafter_pras.cost_cap_pence` remain in whole USD cents (a cap is
 * always a round dollar amount in this app) - `centsToStoredUnits` converts
 * between the two wherever a cap and a spend are compared or displayed
 * together.
 */

export const STORED_UNITS_PER_CENT = 10_000;
export const STORED_UNITS_PER_DOLLAR = STORED_UNITS_PER_CENT * 100;

/** Whole USD cents (e.g. a cost_cap_pence_per_pra setting) -> stored units. */
export function centsToStoredUnits(cents: number): number {
  return Math.round((cents ?? 0) * STORED_UNITS_PER_CENT);
}

/** Fractional USD cents (a computed per-call cost) -> stored units, rounded at the stored-unit's own precision so sub-cent costs are never lost. */
export function fractionalCentsToStoredUnits(cents: number): number {
  return Math.round((cents ?? 0) * STORED_UNITS_PER_CENT);
}

/**
 * Formats a stored-units amount as a dollar string, never rounding a
 * genuinely non-zero amount down to "$0.00": 2dp when that already shows
 * the true value exactly, 3dp otherwise (e.g. "$0.012").
 */
export function formatUsdFromStoredUnits(units: number | null | undefined): string {
  const dollars = (units ?? 0) / STORED_UNITS_PER_DOLLAR;
  if (dollars === 0) return "$0.00";
  const rounded2dp = Math.round(dollars * 100) / 100;
  if (Math.abs(rounded2dp - dollars) < 1e-9) {
    return `$${dollars.toFixed(2)}`;
  }
  return `$${dollars.toFixed(3)}`;
}
