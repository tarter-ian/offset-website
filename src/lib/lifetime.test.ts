import { describe, expect, it } from "vitest";
import { lifetimeOffset } from "./lifetime";
import { LIFETIME_FEE_USD, LIFETIME_MIN_DONATION_USD } from "./pricing";

const now = new Date(Date.UTC(2026, 0, 1));
const typical = { birthYear: 1990, streamingHoursPerDay: 2, aiPromptsPerDay: 10, aiMediaPerWeek: 0 };

describe("lifetimeOffset", () => {
  it("counts internet years from age 12 and AI years from late 2022", () => {
    const o = lifetimeOffset(typical, now);
    expect(o.pastYears.internet).toBeCloseTo(2026 - 2002, 6);
    expect(o.pastYears.ai).toBeCloseTo(2026 - 2022.9, 6);
    expect(o.futureYears).toBeCloseTo(1990 + 85 - 2026, 6);
  });

  it("starts the internet no earlier than 1995", () => {
    expect(lifetimeOffset({ ...typical, birthYear: 1950 }, now).pastYears.internet).toBeCloseTo(31, 6);
  });

  it("costs more for heavier use and adds the one-time fee", () => {
    const light = lifetimeOffset({ ...typical, streamingHoursPerDay: 0.5, aiPromptsPerDay: 1 }, now);
    const heavy = lifetimeOffset({ ...typical, streamingHoursPerDay: 6, aiPromptsPerDay: 200 }, now);
    expect(heavy.donation).toBeGreaterThan(light.donation);
    expect(heavy.total).toBe(heavy.donation + LIFETIME_FEE_USD);
    expect(light.donation).toBeGreaterThanOrEqual(LIFETIME_MIN_DONATION_USD);
  });

  it("lands a typical person in a price people would pay once", () => {
    const o = lifetimeOffset(typical, now);
    expect(o.total).toBeGreaterThan(10);
    expect(o.total).toBeLessThan(200);
  });
});
