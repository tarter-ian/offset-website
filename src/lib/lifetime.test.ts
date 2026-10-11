import { describe, expect, it } from "vitest";
import { DEFAULT_LIFETIME_INPUT, LIFETIME_MAX_USD, lifetimeOffset, parseItems } from "./lifetime";
import { LIFETIME_FEE_USD, LIFETIME_MIN_DONATION_USD } from "./pricing";

const now = new Date(Date.UTC(2026, 0, 1));
const typical = { ...DEFAULT_LIFETIME_INPUT, birthYear: 1990 };

describe("lifetimeOffset", () => {
  it("counts internet years from age 12 and AI years from late 2022", () => {
    const o = lifetimeOffset(typical, undefined, now);
    expect(o.pastYears.internet).toBeCloseTo(2026 - 2002, 6);
    expect(o.pastYears.ai).toBeCloseTo(2026 - 2022.9, 6);
    expect(o.futureYears).toBeCloseTo(1990 + 85 - 2026, 6);
  });

  it("starts the internet no earlier than 1995", () => {
    expect(lifetimeOffset({ ...typical, birthYear: 1950 }, undefined, now).pastYears.internet).toBeCloseTo(31, 6);
  });

  it("costs more for heavier use and adds the one-time fee", () => {
    const light = lifetimeOffset({ ...typical, aiPromptsPerDay: 1 }, ["ai"], now);
    const heavy = lifetimeOffset({ ...typical, aiPromptsPerDay: 200 }, ["ai"], now);
    expect(heavy.donation).toBeGreaterThan(light.donation);
    expect(heavy.total).toBe(heavy.donation + LIFETIME_FEE_USD);
    expect(light.donation).toBe(LIFETIME_MIN_DONATION_USD);
  });

  it("prices each item separately, and together as their sum", () => {
    const all = lifetimeOffset(typical, undefined, now);
    const raw = all.parts.internet.cost + all.parts.ai.cost + all.parts.devices.cost;
    expect(all.donation).toBe(Math.ceil(raw));
    for (const item of ["internet", "ai", "devices"] as const) {
      const one = lifetimeOffset(typical, [item], now);
      expect(one.impacts.carbon).toBeCloseTo(all.parts[item].impacts.carbon, 6);
    }
  });

  it("breaks internet down by activity", () => {
    const o = lifetimeOffset(typical, ["internet"], now);
    const sum = Object.values(o.internetByActivity).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(o.parts.internet.cost, 6);
    const gamer = lifetimeOffset({ ...typical, internetHoursPerDay: { ...typical.internetHoursPerDay, gaming: 2 } }, ["internet"], now);
    expect(gamer.donation).toBeGreaterThan(o.donation);
  });

  it("counts making devices, so more devices cost more", () => {
    const none = lifetimeOffset({ ...typical, devices: { phone: 0, laptop: 0, tablet: 0, desktop: 0, tv: 0, console: 0 } }, ["devices"], now);
    const some = lifetimeOffset(typical, ["devices"], now);
    expect(none.donation).toBe(LIFETIME_MIN_DONATION_USD);
    expect(some.donation).toBeGreaterThan(50);
  });

  it("lands each item in a price people would pay once", () => {
    for (const item of ["internet", "ai", "devices"] as const) {
      const o = lifetimeOffset(typical, [item], now);
      expect(o.total).toBeGreaterThan(5);
      expect(o.total).toBeLessThan(LIFETIME_MAX_USD);
    }
  });
});

describe("spans", () => {
  it("prices past use below lifetime, and monthly as a small recurring amount", () => {
    const heavy = { ...typical, aiPromptsPerDay: 100, aiWhPerPrompt: 3 };
    const past = lifetimeOffset(heavy, ["ai"], now, "past");
    const life = lifetimeOffset(heavy, ["ai"], now, "lifetime");
    const month = lifetimeOffset(heavy, ["ai"], now, "monthly");
    expect(past.donation).toBeLessThan(life.donation);
    expect(month.total).toBeLessThan(past.total);
    expect(month.fee).toBe(1);
    expect(month.donation).toBeGreaterThanOrEqual(1);
  });

  it("charges $1 a month per item, up to the monthly cap", () => {
    expect(lifetimeOffset(typical, ["ai", "internet", "devices"], now, "monthly").fee).toBe(3);
  });

  it("makes a year of monthly payments add up to a year of use", () => {
    const month = lifetimeOffset(typical, ["internet"], now, "monthly");
    const life = lifetimeOffset(typical, ["internet"], now, "lifetime");
    const years = life.pastYears.internet + life.futureYears;
    expect(month.parts.internet.cost * 12 * years).toBeCloseTo(life.parts.internet.cost, 6);
  });
});

describe("parseItems", () => {
  it("reads one or more items and falls back to all", () => {
    expect(parseItems("ai")).toEqual(["ai"]);
    expect(parseItems("devices,internet")).toEqual(["internet", "devices"]);
    expect(parseItems("nope")).toEqual(["ai", "internet", "devices"]);
    expect(parseItems()).toEqual(["ai", "internet", "devices"]);
  });
});
