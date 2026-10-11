import { describe, expect, it } from "vitest";
import {
  CATEGORY_KEYS,
  computeFootprint,
  DEFAULT_ANSWERS,
  gridAirUsdPerKwh,
  gridKgPerKwh,
  MARGINS,
  type Answers,
} from "./footprint";
import { STATES } from "./data/states";
import {
  lifetimeCost,
  LIFETIME_FEE_USD,
  LIFETIME_MIN_DONATION_USD,
  MAX_FEE_USD,
  MIN_DONATION_USD,
  monthlyCost,
} from "./pricing";

const base: Answers = DEFAULT_ANSWERS;
const cat = (a: Answers, key: string) => computeFootprint(a).categories.find((c) => c.key === key)!;

describe("computeFootprint", () => {
  it("uses the state average and the estimated margin when no bill is given", () => {
    const c = cat({ ...base, state: "TX" }, "electricity");
    expect(c.impacts.carbon).toBeCloseTo(STATES.TX.avgKwhPerMonth * gridKgPerKwh("TX"), 6);
    expect(c.confidence).toBe("estimated");
    expect(c.offset.carbon).toBeCloseTo(c.impacts.carbon * (1 + MARGINS.estimated), 6);
    expect(c.offset.water).toBeCloseTo(c.impacts.water * (1 + MARGINS.estimated), 6);
  });

  it("converts a bill amount to kWh with the state price and a smaller margin", () => {
    const c = cat({ ...base, state: "CA", electricity: { mode: "bill", amount: 159.85 } }, "electricity");
    expect(c.note).toContain("500 kWh");
    expect(c.confidence).toBe("entered");
    expect(c.margin).toBe(MARGINS.entered);
  });

  it("prices power plant air pollution from the state's NOx and SO2 rates", () => {
    const wv = cat({ ...base, state: "WV", electricity: { mode: "kwh", amount: 1000 } }, "electricity");
    const ca = cat({ ...base, state: "CA", electricity: { mode: "kwh", amount: 1000 } }, "electricity");
    expect(wv.impacts.air).toBeCloseTo(1000 * gridAirUsdPerKwh(1.1, 1.498), 6);
    expect(wv.impacts.air).toBeGreaterThan(ca.impacts.air * 3);
  });

  it("splits home energy across the household for an individual", () => {
    const one = cat({ ...base, householdSize: 1 }, "electricity").impacts;
    const four = cat({ ...base, householdSize: 4 }, "electricity").impacts;
    expect(four.carbon).toBeCloseTo(one.carbon / 4, 6);
    expect(four.air).toBeCloseTo(one.air / 4, 6);
    const household = cat({ ...base, scope: "household", householdSize: 4 }, "electricity").impacts;
    expect(household.carbon).toBeCloseTo(one.carbon, 6);
  });

  it("multiplies personal habits by household size for a household", () => {
    const one = cat(base, "food").impacts;
    const three = cat({ ...base, scope: "household", householdSize: 3 }, "food").impacts;
    expect(three.land).toBeCloseTo(one.land * 3, 6);
    expect(three.water).toBeCloseTo(one.water * 3, 6);
  });

  it("gives a vegan diet a smaller footprint on every counted impact", () => {
    const vegan = cat({ ...base, diet: "vegan" }, "food").impacts;
    const meat = cat({ ...base, diet: "meat-heavy" }, "food").impacts;
    expect(vegan.carbon).toBeLessThan(meat.carbon);
    expect(vegan.water).toBeLessThan(meat.water);
    expect(vegan.land).toBeLessThan(meat.land);
  });

  it("does not double count electric heating or an EV charged at home on a known bill", () => {
    expect(cat({ ...base, heating: { fuel: "electric", mode: "average" } }, "heating").impacts.carbon).toBe(0);
    const ev = { type: "electric" as const, milesPerWeek: 100, chargedAtHome: true };
    expect(cat({ ...base, car: ev, electricity: { mode: "kwh", amount: 900 } }, "car").impacts.carbon).toBe(0);
    expect(cat({ ...base, car: ev }, "car").impacts.carbon).toBeGreaterThan(0);
  });

  it("puts a typical American near 15 to 20 tonnes a year", () => {
    const yearly = (computeFootprint({ ...base, state: "OH" }).total.carbon * 12) / 1000;
    expect(yearly).toBeGreaterThan(12);
    expect(yearly).toBeLessThan(22);
  });

  it("keeps AI and streaming a small share of carbon", () => {
    const f = computeFootprint(base);
    const digital = cat(base, "ai").impacts.carbon + cat(base, "streaming").impacts.carbon;
    expect(digital / f.total.carbon).toBeLessThan(0.01);
  });

  it("uses the measured margin when AI use comes from a data export", () => {
    const c = cat({ ...base, digital: { ...base.digital, aiFromExport: true } }, "ai");
    expect(c.confidence).toBe("measured");
    expect(c.margin).toBe(MARGINS.measured);
  });

  it("ignores negative or missing numbers", () => {
    expect(cat({ ...base, car: { type: "gas", milesPerWeek: -50 } }, "car").impacts.carbon).toBe(0);
    const f = computeFootprint({ ...base, flights: { shortPerYear: NaN, longPerYear: -1 } });
    expect(f.total.carbon).toBeGreaterThan(0);
  });
});

describe("monthlyCost", () => {
  const f = computeFootprint(base);

  it("charges a dollar fee per covered category, capped", () => {
    expect(monthlyCost(f, ["ai"]).fee).toBe(1);
    expect(monthlyCost(f, ["ai", "food"]).fee).toBe(2);
    expect(monthlyCost(f, CATEGORY_KEYS).fee).toBe(MAX_FEE_USD);
  });

  it("only prices the covered categories", () => {
    const food = monthlyCost(f, ["food"]);
    const all = monthlyCost(f, CATEGORY_KEYS);
    expect(food.donation).toBeLessThan(all.donation);
    expect(food.byImpact.land).toBeCloseTo(all.byImpact.land, 6);
  });

  it("raises a tiny donation to the minimum and says so", () => {
    const ai = monthlyCost(f, ["ai"]);
    expect(ai.minimumApplied).toBe(true);
    expect(ai.donation).toBe(MIN_DONATION_USD);
    expect(ai.total).toBe(MIN_DONATION_USD + 1);
  });

  it("charges nothing when nothing is covered", () => {
    expect(monthlyCost(f, []).total).toBe(0);
  });
});

describe("lifetimeCost", () => {
  const f = computeFootprint(base);

  it("is offered for plans under the monthly minimum, at least the lifetime minimum", () => {
    const life = lifetimeCost(monthlyCost(f, ["ai"]));
    expect(life?.donation).toBe(LIFETIME_MIN_DONATION_USD);
    expect(life?.total).toBe(LIFETIME_MIN_DONATION_USD + LIFETIME_FEE_USD);
  });

  it("scales with heavy use", () => {
    const heavy = computeFootprint({ ...base, digital: { aiPromptsPerDay: 2000, aiMediaPerWeek: 0, streamingHoursPerDay: 0 } });
    const m = monthlyCost(heavy, ["ai"]);
    const raw = m.byImpact.carbon + m.byImpact.air + m.byImpact.water + m.byImpact.land;
    expect(m.minimumApplied).toBe(true);
    expect(lifetimeCost(m)?.donation).toBe(Math.max(LIFETIME_MIN_DONATION_USD, Math.ceil(raw * 12 * 30 * 3)));
  });

  it("is not offered for bigger plans", () => {
    expect(lifetimeCost(monthlyCost(f, CATEGORY_KEYS))).toBeNull();
  });
});
