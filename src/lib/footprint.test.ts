import { describe, expect, it } from "vitest";
import { computeFootprint, DEFAULT_ANSWERS, gridKgPerKwh, MARGINS, type Answers } from "./footprint";
import { STATES } from "./data/states";
import { monthlyCost } from "./pricing";

const base: Answers = DEFAULT_ANSWERS;
const cat = (a: Answers, key: string) => computeFootprint(a).categories.find((c) => c.key === key)!;

describe("computeFootprint", () => {
  it("uses the state average and the estimated margin when no bill is given", () => {
    const c = cat({ ...base, state: "TX" }, "electricity");
    expect(c.kg).toBeCloseTo(STATES.TX.avgKwhPerMonth * gridKgPerKwh("TX"), 6);
    expect(c.confidence).toBe("estimated");
    expect(c.offsetKg).toBeCloseTo(c.kg * (1 + MARGINS.estimated), 6);
  });

  it("converts a bill amount to kWh with the state price and a smaller margin", () => {
    const c = cat({ ...base, state: "CA", electricity: { mode: "bill", amount: 159.85 } }, "electricity");
    expect(c.note).toContain("500 kWh");
    expect(c.confidence).toBe("entered");
    expect(c.margin).toBe(MARGINS.entered);
  });

  it("splits home energy across the household for an individual", () => {
    const one = cat({ ...base, householdSize: 1 }, "electricity").kg;
    const four = cat({ ...base, householdSize: 4 }, "electricity").kg;
    expect(four).toBeCloseTo(one / 4, 6);
    const household = cat({ ...base, scope: "household", householdSize: 4 }, "electricity").kg;
    expect(household).toBeCloseTo(one, 6);
  });

  it("multiplies personal habits by household size for a household", () => {
    const one = cat(base, "food").kg;
    expect(cat({ ...base, scope: "household", householdSize: 3 }, "food").kg).toBeCloseTo(one * 3, 6);
  });

  it("does not double count electric heating or an EV charged at home on a known bill", () => {
    expect(cat({ ...base, heating: { fuel: "electric", mode: "average" } }, "heating").kg).toBe(0);
    const ev = { type: "electric" as const, milesPerWeek: 100, chargedAtHome: true };
    expect(cat({ ...base, car: ev, electricity: { mode: "kwh", amount: 900 } }, "car").kg).toBe(0);
    expect(cat({ ...base, car: ev }, "car").kg).toBeGreaterThan(0);
  });

  it("puts a typical American near 15 to 20 tonnes a year", () => {
    const yearly = (computeFootprint({ ...base, state: "OH" }).totalKg * 12) / 1000;
    expect(yearly).toBeGreaterThan(12);
    expect(yearly).toBeLessThan(22);
  });

  it("keeps AI and streaming a small share", () => {
    const f = computeFootprint(base);
    expect(cat(base, "digital").kg / f.totalKg).toBeLessThan(0.01);
  });

  it("ignores negative or missing numbers", () => {
    const f = computeFootprint({ ...base, car: { type: "gas", milesPerWeek: -50 }, flights: { shortPerYear: NaN, longPerYear: -1 } });
    expect(cat({ ...base, car: { type: "gas", milesPerWeek: -50 } }, "car").kg).toBe(0);
    expect(f.totalKg).toBeGreaterThan(0);
  });
});

describe("monthlyCost", () => {
  it("charges the donation per tonne plus the fee", () => {
    const c = monthlyCost(2000);
    expect(c.donation).toBe(30);
    expect(c.total).toBe(c.donation + c.fee);
  });
});
