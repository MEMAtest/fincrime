import { describe, it, expect } from "vitest";
import { centsToStoredUnits, fractionalCentsToStoredUnits, formatUsdFromStoredUnits, STORED_UNITS_PER_DOLLAR } from "../money";

/**
 * PRA Drafter defect: "SPEND SHOWS $0.00 after ~20 real calls". Root cause
 * was rounding a real call's cost (a small fraction of a cent) to whole
 * cents before storing it - every call truncated to 0. These tests prove a
 * realistic per-call cost survives storage and never displays as $0.00.
 */
describe("money (PRA Drafter spend precision)", () => {
  it("never rounds a real, tiny per-call cost to zero", () => {
    // A realistic OpenRouter call: ~1500 prompt tokens, ~400 completion
    // tokens, at $0.20/1M in and $1.20/1M out (cents-per-1M, as configured).
    const costCents = (1500 / 1_000_000) * 20 + (400 / 1_000_000) * 120;
    expect(costCents).toBeGreaterThan(0);
    expect(Math.round(costCents)).toBe(0); // the OLD (buggy) behaviour: truncates to 0
    const stored = fractionalCentsToStoredUnits(costCents);
    expect(stored).toBeGreaterThan(0); // the fix: survives as a non-zero stored amount
  });

  it("sums 20 realistic small calls to a non-zero, correctly priced total", () => {
    const perCallCents = (1500 / 1_000_000) * 20 + (400 / 1_000_000) * 120; // ~0.078 cents
    const perCallStored = fractionalCentsToStoredUnits(perCallCents);
    const totalStored = perCallStored * 20;
    const totalDollars = totalStored / STORED_UNITS_PER_DOLLAR;
    expect(totalDollars).toBeGreaterThan(0);
    expect(totalDollars).toBeCloseTo((perCallCents * 20) / 100, 6);
  });

  it("formatUsdFromStoredUnits shows a non-zero spend with enough precision, never as $0.00", () => {
    const stored = fractionalCentsToStoredUnits(1.2); // 1.2 cents = $0.012
    expect(formatUsdFromStoredUnits(stored)).toBe("$0.012");
    expect(formatUsdFromStoredUnits(stored)).not.toBe("$0.00");
  });

  it("formatUsdFromStoredUnits shows exact 2dp amounts at 2dp", () => {
    expect(formatUsdFromStoredUnits(centsToStoredUnits(2000))).toBe("$20.00");
    expect(formatUsdFromStoredUnits(0)).toBe("$0.00");
    expect(formatUsdFromStoredUnits(null)).toBe("$0.00");
  });

  it("centsToStoredUnits and fractionalCentsToStoredUnits agree for whole-cent inputs", () => {
    expect(centsToStoredUnits(5)).toBe(fractionalCentsToStoredUnits(5));
  });
});
