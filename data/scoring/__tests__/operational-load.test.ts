import { describe, expect, it } from "vitest";
import {
  scoreOperationalLoad,
  summariseOperationalLoad,
  DEFAULT_HOURLY_COST_GBP,
} from "../operational-load";

describe("scoreOperationalLoad", () => {
  it("returns all zeros for zero monthly volume", () => {
    const result = scoreOperationalLoad({
      monthlyVolume: 0,
      alertRatePct: 5,
      handlingMinutes: 20,
    });
    expect(result).toEqual({
      alertsPerMonth: 0,
      analystHoursPerMonth: 0,
      fte: 0,
      monthlyCostGbp: 0,
    });
  });

  it("matches the worked example: 10,000 volume, 5% alert rate, 20 min handling", () => {
    const result = scoreOperationalLoad({
      monthlyVolume: 10000,
      alertRatePct: 5,
      handlingMinutes: 20,
    });
    expect(result.alertsPerMonth).toBe(500);
    expect(result.analystHoursPerMonth).toBeCloseTo(166.67, 2);
    expect(result.fte).toBeCloseTo(1.04, 2);
    // 166.666... hours * default 35/hr = 5833.33
    expect(result.monthlyCostGbp).toBeCloseTo(5833.33, 2);
  });

  it("uses the default hourly cost when none is supplied", () => {
    const withDefault = scoreOperationalLoad({
      monthlyVolume: 1000,
      alertRatePct: 10,
      handlingMinutes: 15,
    });
    const withExplicitDefault = scoreOperationalLoad({
      monthlyVolume: 1000,
      alertRatePct: 10,
      handlingMinutes: 15,
      hourlyCostGbp: DEFAULT_HOURLY_COST_GBP,
    });
    expect(withDefault).toEqual(withExplicitDefault);
  });

  it("scales cost with a custom hourly rate", () => {
    const result = scoreOperationalLoad({
      monthlyVolume: 1000,
      alertRatePct: 10,
      handlingMinutes: 30,
      hourlyCostGbp: 50,
    });
    // alerts = 100, hours = 100*30/60 = 50, cost = 50*50 = 2500
    expect(result.alertsPerMonth).toBe(100);
    expect(result.analystHoursPerMonth).toBe(50);
    expect(result.monthlyCostGbp).toBe(2500);
  });

  it("clamps negative inputs to zero rather than propagating them", () => {
    const result = scoreOperationalLoad({
      monthlyVolume: -1000,
      alertRatePct: -5,
      handlingMinutes: -20,
      hourlyCostGbp: -35,
    });
    expect(result).toEqual({
      alertsPerMonth: 0,
      analystHoursPerMonth: 0,
      fte: 0,
      monthlyCostGbp: 0,
    });
  });

  it("clamps non-finite (NaN/Infinity) inputs to zero", () => {
    const result = scoreOperationalLoad({
      monthlyVolume: Number.NaN,
      alertRatePct: Number.POSITIVE_INFINITY,
      handlingMinutes: 20,
    });
    expect(result.alertsPerMonth).toBe(0);
    expect(result.analystHoursPerMonth).toBe(0);
    expect(result.fte).toBe(0);
    expect(result.monthlyCostGbp).toBe(0);
  });

  it("a negative hourly cost alone still zeros out monthly cost even with real volume", () => {
    const result = scoreOperationalLoad({
      monthlyVolume: 1000,
      alertRatePct: 10,
      handlingMinutes: 20,
      hourlyCostGbp: -35,
    });
    expect(result.alertsPerMonth).toBe(100);
    expect(result.analystHoursPerMonth).toBeGreaterThan(0);
    expect(result.monthlyCostGbp).toBe(0);
  });
});

describe("summariseOperationalLoad", () => {
  it("returns zero totals and an empty breakdown for no controls", () => {
    const summary = summariseOperationalLoad([]);
    expect(summary.perControl).toEqual([]);
    expect(summary.totals).toEqual({
      alertsPerMonth: 0,
      analystHoursPerMonth: 0,
      fte: 0,
      monthlyCostGbp: 0,
    });
  });

  it("aggregates totals across controls while preserving the per-control breakdown", () => {
    const inputs = [
      { monthlyVolume: 10000, alertRatePct: 5, handlingMinutes: 20 }, // 500 alerts, 166.67h
      { monthlyVolume: 1000, alertRatePct: 10, handlingMinutes: 30 }, // 100 alerts, 50h
    ];
    const summary = summariseOperationalLoad(inputs);

    expect(summary.perControl).toHaveLength(2);
    expect(summary.perControl[0].alertsPerMonth).toBe(500);
    expect(summary.perControl[1].alertsPerMonth).toBe(100);

    expect(summary.totals.alertsPerMonth).toBe(600);
    expect(summary.totals.analystHoursPerMonth).toBeCloseTo(216.67, 2);
    expect(summary.totals.fte).toBeCloseTo(
      summary.perControl[0].fte + summary.perControl[1].fte,
      2
    );
    expect(summary.totals.monthlyCostGbp).toBeCloseTo(
      summary.perControl[0].monthlyCostGbp + summary.perControl[1].monthlyCostGbp,
      2
    );
  });
});
