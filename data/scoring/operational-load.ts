/**
 * Operational load = the analyst time and cost a control's alert volume
 * generates each month. Deterministic and pure, mirroring the rest of
 * data/scoring: no AI, no I/O, no randomness.
 */

export interface OperationalLoadInput {
  /** Expected monthly transaction/event volume passing through the control. */
  monthlyVolume: number;
  /** Percentage (0-100) of that volume expected to alert. */
  alertRatePct: number;
  /** Analyst minutes to work one alert to closure. */
  handlingMinutes: number;
  /** Fully loaded analyst hourly cost. Defaults to an indicative UK compliance-analyst rate. */
  hourlyCostGbp?: number;
}

export const DEFAULT_HOURLY_COST_GBP = 35;

/** Hours in one full-time-equivalent month, used to express load as headcount. */
export const HOURS_PER_FTE_MONTH = 160;

export interface OperationalLoadResult {
  alertsPerMonth: number;
  analystHoursPerMonth: number;
  /** Analyst headcount (of a 160-hour month) this control's alert volume requires. */
  fte: number;
  monthlyCostGbp: number;
}

/**
 * Negative or non-finite inputs (NaN, Infinity) are meaningless for a volume,
 * rate, minutes or cost, so they clamp to 0 rather than propagating into a
 * broken downstream figure.
 */
function clampNonNegative(value: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/**
 * All four outputs round to 2 decimal places for presentation, but every
 * intermediate figure in the chain (alerts -> hours -> FTE -> cost) is
 * computed from the raw, unrounded value that precedes it. Rounding once at
 * each output rather than compounding rounded inputs keeps the chain
 * internally consistent (e.g. hours divided by alerts recovers the exact
 * handling time, not a value skewed by an earlier rounding step).
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function scoreOperationalLoad(input: OperationalLoadInput): OperationalLoadResult {
  const monthlyVolume = clampNonNegative(input.monthlyVolume);
  const alertRatePct = clampNonNegative(input.alertRatePct);
  const handlingMinutes = clampNonNegative(input.handlingMinutes);
  const hourlyCostGbp = clampNonNegative(input.hourlyCostGbp ?? DEFAULT_HOURLY_COST_GBP);

  const alertsPerMonth = monthlyVolume * (alertRatePct / 100);
  const analystHoursPerMonth = (alertsPerMonth * handlingMinutes) / 60;
  const fte = analystHoursPerMonth / HOURS_PER_FTE_MONTH;
  const monthlyCostGbp = analystHoursPerMonth * hourlyCostGbp;

  return {
    alertsPerMonth: round2(alertsPerMonth),
    analystHoursPerMonth: round2(analystHoursPerMonth),
    fte: round2(fte),
    monthlyCostGbp: round2(monthlyCostGbp),
  };
}

export interface OperationalLoadSummary {
  totals: OperationalLoadResult;
  perControl: OperationalLoadResult[];
}

const ZERO_LOAD: OperationalLoadResult = {
  alertsPerMonth: 0,
  analystHoursPerMonth: 0,
  fte: 0,
  monthlyCostGbp: 0,
};

/** Aggregates operational load across every alert-generating control on an assessment. */
export function summariseOperationalLoad(inputs: OperationalLoadInput[]): OperationalLoadSummary {
  const perControl = inputs.map(scoreOperationalLoad);

  const totals = perControl.reduce(
    (acc, item) => ({
      alertsPerMonth: round2(acc.alertsPerMonth + item.alertsPerMonth),
      analystHoursPerMonth: round2(acc.analystHoursPerMonth + item.analystHoursPerMonth),
      fte: round2(acc.fte + item.fte),
      monthlyCostGbp: round2(acc.monthlyCostGbp + item.monthlyCostGbp),
    }),
    { ...ZERO_LOAD }
  );

  return { totals, perControl };
}
