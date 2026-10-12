import { describe, expect, it } from "vitest";
import {
  areaOf,
  CATEGORY_KEYS,
  computeFootprint,
  DEFAULT_ANSWERS,
  gridAirUsdPerKwh,
  gridKgPerKwh,
  MARGINS,
  type Answers,
} from "./footprint";
import { STATES } from "./data/states";
import * as F from "./factors";
import {
  lifetimeCost,
  LIFETIME_GROWTH_BUFFER,
  LIFETIME_MIN_DONATION_USD,
  paymentFee,
  MIN_DONATION_USD,
  monthlyCost,
  type CarbonMode,
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
    expect(wv.impacts.air).toBeCloseTo((1000 / (1 - F.GRID_LINE_LOSS)) * gridAirUsdPerKwh(1.1, 1.498), 6);
    expect(wv.impacts.air).toBeGreaterThan(ca.impacts.air * 3);
  });

  it("adds fuel supply and line losses to the smokestack rate, and prices AI at new-demand plants", async () => {
    const { aiImpacts, gridImpacts } = await import("./footprint");
    const stack = (STATES.TX.gridLbPerMwh * F.KG_PER_LB) / 1000;
    expect(gridKgPerKwh("TX")).toBeCloseTo((stack * (1 + F.GRID_UPSTREAM_SHARE)) / (1 - F.GRID_LINE_LOSS), 9);
    const kwh = 1 - F.AI_TRAINING_SHARE;
    const grid = gridImpacts(1).carbon;
    expect(aiImpacts(kwh).carbon).toBeCloseTo((grid * (F.AI_NEW_POWER_LB_PER_MWH / F.US_GRID_LB_PER_MWH)) / (1 - F.AI_HARDWARE_SHARE), 9);
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
    const one = cat(base, "meat").impacts;
    const three = cat({ ...base, scope: "household", householdSize: 3 }, "meat").impacts;
    expect(three.land).toBeCloseTo(one.land * 3, 6);
    expect(three.water).toBeCloseTo(one.water * 3, 6);
  });

  it("gives a vegan diet a smaller food footprint on every counted impact", () => {
    const food = (a: Answers) =>
      computeFootprint(a)
        .categories.filter((c) => areaOf(c.key).key === "food")
        .reduce((s, c) => s + c.impacts.carbon + c.impacts.water + c.impacts.land, 0);
    expect(food({ ...base, diet: "vegan" })).toBeLessThan(food({ ...base, diet: "meat-heavy" }));
    expect(cat({ ...base, diet: "vegan" }, "meat").impacts.carbon).toBe(0);
  });

  it("splits food and shopping without losing any of the total", () => {
    const f = computeFootprint(base);
    const areaCarbon = (key: string) =>
      f.categories.filter((c) => areaOf(c.key).key === key).reduce((s, c) => s + c.impacts.carbon, 0);
    expect(areaCarbon("food")).toBeCloseTo(2500 / 12, 6);
    expect(areaCarbon("shopping")).toBeCloseTo(5000 / 12, 6);
  });

  it("counts bus and train miles", () => {
    expect(cat({ ...base, transit: { milesPerWeek: 50 } }, "transit").impacts.carbon).toBeGreaterThan(0);
    expect(cat(base, "transit").impacts.carbon).toBe(0);
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

  it("charges the card fee on what's covered, and nothing when nothing is", () => {
    expect(monthlyCost(f, []).fee).toBe(0);
    const all = monthlyCost(f, CATEGORY_KEYS);
    expect(all.fee).toBe(paymentFee(all.donation));
  });

  it("only prices the covered categories", () => {
    const food = monthlyCost(f, ["meat", "dairy", "plants"]);
    const all = monthlyCost(f, CATEGORY_KEYS);
    expect(food.donation).toBeLessThan(all.donation);
    // Food and shopping hold most of the land; power plants and data centers add a little.
    const landHeavy = monthlyCost(f, ["meat", "dairy", "plants", "clothing", "electronics", "household", "services"]).byImpact.land;
    expect(landHeavy).toBeLessThan(all.byImpact.land);
    expect(landHeavy / all.byImpact.land).toBeGreaterThan(0.99);
  });

  it("only prices the chosen impact types", () => {
    const water = monthlyCost(f, CATEGORY_KEYS, ["water"]);
    expect(water.byImpact.carbon).toBe(0);
    expect(water.byImpact.water).toBeGreaterThan(0);
    expect(monthlyCost(f, CATEGORY_KEYS, []).total).toBe(0);
  });

  it("raises a tiny donation to the minimum and says so", () => {
    const ai = monthlyCost(f, ["ai"]);
    expect(ai.minimumApplied).toBe(true);
    expect(ai.donation).toBe(MIN_DONATION_USD);
    expect(ai.total).toBeCloseTo(MIN_DONATION_USD + paymentFee(MIN_DONATION_USD), 6);
  });

  it("charges nothing when nothing is covered", () => {
    expect(monthlyCost(f, []).total).toBe(0);
  });
});

describe("lifetimeCost", () => {
  const f = computeFootprint(base);

  it("is offered for plans under the monthly minimum, at least the lifetime minimum", () => {
    const life = lifetimeCost(monthlyCost(f, ["ai"]));
    expect(life?.donation).toBeGreaterThanOrEqual(LIFETIME_MIN_DONATION_USD);
    expect(life?.total).toBeCloseTo(life!.donation + paymentFee(life!.donation), 6);
  });

  it("scales with heavy use", () => {
    const heavy = computeFootprint({ ...base, digital: { aiPromptsPerDay: 2000, aiMediaPerWeek: 0, streamingHoursPerDay: 0 } });
    const m = monthlyCost(heavy, ["ai"]);
    const raw = m.byImpact.carbon + m.byImpact.air + m.byImpact.water + m.byImpact.land;
    expect(m.minimumApplied).toBe(true);
    expect(lifetimeCost(m)?.donation).toBe(Math.max(LIFETIME_MIN_DONATION_USD, Math.ceil(raw * 12 * 30 * LIFETIME_GROWTH_BUFFER)));
  });

  it("is not offered for bigger plans", () => {
    expect(lifetimeCost(monthlyCost(f, CATEGORY_KEYS))).toBeNull();
  });
});

describe("carbon modes", () => {
  const f = computeFootprint(base);
  it("prices climate higher as verification rises", () => {
    const c = (m: CarbonMode) => monthlyCost(f, CATEGORY_KEYS, ["carbon"], m).byImpact.carbon;
    expect(c("expected")).toBeLessThan(c("blend"));
    expect(c("blend")).toBeLessThan(c("verified"));
    expect(c("blend") / c("expected")).toBeCloseTo(49 / 15, 6);
  });
});

describe("holistic harms", () => {
  const base = computeFootprint(DEFAULT_ANSWERS);
  const cat = (f: ReturnType<typeof computeFootprint>, k: string) => f.categories.find((c) => c.key === k)!;

  it("counts farm air pollution, most of it from meat, and none of meat's on a vegan diet", () => {
    expect(cat(base, "meat").impacts.air).toBeGreaterThan(cat(base, "plants").impacts.air);
    const vegan = computeFootprint({ ...DEFAULT_ANSWERS, diet: "vegan" });
    expect(cat(vegan, "meat").impacts.air).toBe(0);
    expect(cat(base, "meat").notCounted).toEqual([]);
  });

  it("counts air and water for flights, transit and driving", () => {
    const f = computeFootprint({ ...DEFAULT_ANSWERS, flights: { shortPerYear: 2, longPerYear: 0 }, transit: { milesPerWeek: 20 } });
    for (const k of ["flights", "transit", "car"]) {
      expect(cat(f, k).impacts.water, k).toBeGreaterThan(0);
      expect(cat(f, k).notCounted, k).toEqual([]);
    }
    expect(cat(f, "flights").impacts.air).toBeGreaterThan(0);
  });

  it("counts water and land for making electronics", () => {
    expect(cat(base, "electronics").impacts.water).toBeGreaterThan(0);
    expect(cat(base, "electronics").impacts.land).toBeGreaterThan(0);
  });

  it("counts every harm for clothing, home goods and services", () => {
    for (const k of ["clothing", "household", "services"]) {
      const c = cat(base, k);
      for (const i of ["water", "land", "air"] as const) expect(c.impacts[i], `${k} ${i}`).toBeGreaterThan(0);
      expect(c.notCounted, k).toEqual([]);
    }
  });
});

describe("gaps closed 2026-10-12", () => {
  const cat = (f: ReturnType<typeof computeFootprint>, k: string) => f.categories.find((c) => c.key === k)!;

  it("counts air pollution from oil and propane heating", () => {
    for (const fuel of ["oil", "propane"] as const) {
      const c = cat(computeFootprint({ ...DEFAULT_ANSWERS, heating: { fuel, mode: "average" } }), "heating");
      expect(c.impacts.air, fuel).toBeGreaterThan(0);
      expect(c.notCounted, fuel).toEqual([]);
    }
  });

  it("counts air pollution from making electronics", () => {
    const c = cat(computeFootprint(DEFAULT_ANSWERS), "electronics");
    expect(c.impacts.air).toBeGreaterThan(0);
    expect(c.notCounted).toEqual([]);
  });

  it("adds the AI built into other apps even with no chatbot use", () => {
    const f = computeFootprint({ ...DEFAULT_ANSWERS, digital: { ...DEFAULT_ANSWERS.digital, aiPromptsPerDay: 0, aiMediaPerWeek: 0 } });
    expect(cat(f, "ai").impacts.carbon).toBeGreaterThan(0);
  });
});

describe("shopping by the dollar", () => {
  it("prices goods by dollars spent when given, leaving services on the level", () => {
    const f = computeFootprint({ ...DEFAULT_ANSWERS, shoppingUsd: { clothing: 100 } });
    expect(f.categories.find((c) => c.key === "clothing")!.impacts.carbon).toBeCloseTo(100 * F.GOODS_KG_CO2_PER_USD.clothing, 6);
    const plain = computeFootprint(DEFAULT_ANSWERS);
    expect(f.categories.find((c) => c.key === "services")!.impacts.carbon).toBeCloseTo(plain.categories.find((c) => c.key === "services")!.impacts.carbon, 6);
  });
});
