import { describe, expect, it } from "vitest";
import { aheadFor, yearlyLine, coverBadge, coverPrice, DEFAULT_CONTEXT as C, defaultAmount, effectiveCover, planTotals, PRODUCTS, productById } from "./store";
import {
  ANNUAL_MIN_DONATION_USD,
  DEFAULT_BILLING,
  LIFETIME_MIN_DONATION_USD,
  feeParts,
  paymentFee,
  MIN_DONATION_USD,
} from "./pricing";

const p = (id: string) => productById(id)!;

describe("products", () => {
  it("prices every item above zero at its default amount (or 1, for items most people don't use)", () => {
    for (const item of PRODUCTS) {
      const a = defaultAmount(item, C) || 1;
      const price = coverPrice(item, a, effectiveCover(item, a, C), C);
      expect(price.once + price.monthly, item.id).toBeGreaterThan(0);
    }
  });

  it("costs more for more use", () => {
    expect(p("ai").cost(100, "lifetime", C)).toBeGreaterThan(p("ai").cost(10, "lifetime", C));
    expect(p("car").cost(400, "monthly", C)).toBeGreaterThan(p("car").cost(100, "monthly", C));
    expect(p("meat").cost("meat-heavy", "monthly", C)).toBeGreaterThan(p("meat").cost("vegan", "monthly", C));
  });

  it("uses measured AI energy when an account is linked", () => {
    expect(p("ai").cost(10, "lifetime", { ...C, aiWhPerPrompt: 3, aiFromExport: true })).toBeGreaterThan(
      p("ai").cost(10, "lifetime", C) * 5,
    );
  });
});

describe("why lines", () => {
  it("gives every item a yearly carbon figure, compared to driving outside the travel aisle", () => {
    for (const item of PRODUCTS) expect(item.kgPerYear(defaultAmount(item, C) || 1, C), item.id).toBeGreaterThan(0);
    expect(yearlyLine(p("video"), 2, C)).toMatch(/^About \d+ kg of CO₂e a year, like driving \d+ miles\.$/);
    expect(yearlyLine(p("car"), 200, C)).not.toMatch(/driving/);
    expect(p("video").kgPerYear(4, C)).toBeCloseTo(2 * p("video").kgPerYear(2, C), 6);
  });
});

describe("covers", () => {
  it("offers every item monthly, leading with lifetime only for AI and items under $1 a month", () => {
    expect(aheadFor(p("ai"), 10, C)).toEqual(["monthly", "lifetime"]);
    expect(effectiveCover(p("ai"), 10, C).ahead).toBe("lifetime");
    // Heavy AI use leads with monthly once lifetime passes $100.
    expect(effectiveCover(p("ai"), 10, { ...C, aiWhPerPrompt: 300, aiFromExport: true }).ahead).toBe("monthly");
    expect(effectiveCover(p("video"), 2, C).ahead).toBe("lifetime");
    expect(effectiveCover(p("video"), 2, C, { ahead: "monthly" }).ahead).toBe("monthly");
    expect(effectiveCover(p("ai"), 10, C).ahead).toBe("lifetime");
    expect(aheadFor(p("car"), 200, C)).toEqual(["monthly"]);
  });

  it("hides lifetime above $1,000 unless asked", () => {
    expect(aheadFor(p("desktop"), 1, C)).toEqual(["monthly", "lifetime"]);
    expect(aheadFor(p("ai"), 20000, C)).toEqual(["monthly"]);
    expect(aheadFor(p("ai"), 20000, C, true)).toEqual(["monthly", "lifetime"]);
    expect(effectiveCover(p("ai"), 20000, C, { ahead: "lifetime" }).ahead).toBe("monthly");
  });

  it("checks past use by default on one-time items only, and lets it be unchecked", () => {
    expect(effectiveCover(p("ai"), 10, C).past).toBe(true);
    expect(effectiveCover(p("ai"), 10, C, { past: false }).past).toBe(false);
    expect(effectiveCover(p("car"), 200, C, { past: true }).past).toBe(false);
  });

  it("splits lifetime into past use plus the years to come", () => {
    const life = p("ai").cost(10, "lifetime", C);
    const both = coverPrice(p("ai"), 10, { past: true, ahead: "lifetime" }, C);
    const ahead = coverPrice(p("ai"), 10, { past: false, ahead: "lifetime" }, C);
    expect(both.once).toBeCloseTo(life, 6);
    expect(ahead.once).toBeLessThan(both.once);
  });

  it("uses real AI history for past use when an export is linked", () => {
    const linked = { ...C, aiFromExport: true, aiWhPerPrompt: 0.3, aiPastWh: 50 };
    expect(p("ai").cost(10, "past", linked)).toBeLessThan(p("ai").cost(10, "past", C));
    expect(p("ai").cost(10, "past", { ...linked, aiPastWh: 500_000 })).toBeGreaterThan(p("ai").cost(10, "past", C));
    expect(p("ai").cost(10, "lifetime", linked)).toBeCloseTo(p("ai").cost(10, "past", linked) + p("ai").cost(10, "future", linked), 6);
  });

  it("can pay past use once and the rest as it happens", () => {
    const t = planTotals([{ productId: "desktop", amount: 1, cover: { past: true, ahead: "monthly" } }], C, "monthly");
    expect(t.oneTime!.donation).toBe(Math.max(LIFETIME_MIN_DONATION_USD, Math.ceil(p("desktop").cost(1, "past", C))));
    expect(t.recurring).not.toBeNull();
    expect(coverBadge({ past: true, ahead: "monthly" }, "monthly")).toBe("to date + each month");
    expect(coverBadge({ past: true, ahead: "lifetime" }, "monthly")).toBe("for life");
  });
});

describe("billing", () => {
  it("defaults to monthly", () => {
    expect(DEFAULT_BILLING).toBe("monthly");
  });
});

describe("planTotals", () => {
  it("applies one minimum to one-time items, one flat monthly fee, and waives the one-time fee alongside a monthly plan", () => {
    const t = planTotals(
      [
        { productId: "ai", amount: 10, cover: { past: true, ahead: "lifetime" } },
        { productId: "music", amount: 1, cover: { past: true, ahead: "lifetime" } },
        ...["car", "flights", "transit", "meat", "dairy"].map((id) => ({ productId: id, amount: defaultAmount(p(id), C), cover: { past: false, ahead: "monthly" as const } })),
      ],
      C,
      "monthly",
    );
    expect(t.oneTime!.donation).toBeGreaterThanOrEqual(LIFETIME_MIN_DONATION_USD);
    expect(t.oneTime!.fee).toBe(paymentFee(t.oneTime!.donation));
    expect(t.recurring!.fee).toBe(paymentFee(t.recurring!.donation));
    expect(t.recurring!.donation).toBeGreaterThan(MIN_DONATION_USD);
  });

  it("charges only the card and sponsor fees, so the donation arrives whole", () => {
    // 30¢ + 2.2% for the card and 8% for the sponsor, of the whole payment, rounded up to the cent.
    expect(paymentFee(10)).toBe(1.47);
    expect(paymentFee(100)).toBe(11.7);
    for (const d of [1, 7.5, 40, 386]) {
      const total = d + paymentFee(d);
      expect(total - (0.3 + 0.022 * total) - 0.08 * total).toBeGreaterThanOrEqual(d - 1e-9);
      const parts = feeParts(d);
      expect(parts.card + parts.sponsor).toBeCloseTo(paymentFee(d), 6);
    }
    expect(paymentFee(0)).toBe(0);
  });

  it("bills ongoing items yearly with one card fee a year", () => {
    const line = [{ productId: "car", amount: 200, cover: { past: false, ahead: "monthly" as const } }];
    const month = planTotals(line, C, "monthly").recurring!;
    const year = planTotals(line, C, "annual").recurring!;
    expect(year.fee).toBeLessThan(month.fee * 12);
    expect(year.donation).toBeCloseTo(Math.ceil(p("car").cost(200, "monthly", C) * 12), 6);
  });

  it("leaves out a side with no items, and applies the minimum", () => {
    const t = planTotals([{ productId: "transit", amount: 1, cover: { past: false, ahead: "monthly" } }], C, "monthly");
    expect(t.oneTime).toBeNull();
    expect(t.recurring!.donation).toBe(MIN_DONATION_USD);
    expect(planTotals([{ productId: "transit", amount: 1, cover: { past: false, ahead: "monthly" } }], C, "annual").recurring!.donation).toBe(ANNUAL_MIN_DONATION_USD);
  });
});
