import { describe, expect, it } from "vitest";
import { DEFAULT_CONTEXT as C, defaultAmount, effectiveSpan, planTotals, PRODUCTS, productById, spansFor } from "./store";
import { LIFETIME_FEE_USD, LIFETIME_MIN_DONATION_USD, MAX_FEE_USD, MIN_DONATION_USD } from "./pricing";

const p = (id: string) => productById(id)!;

describe("products", () => {
  it("prices every item above zero at its default amount", () => {
    for (const item of PRODUCTS) {
      const a = defaultAmount(item, C);
      expect(item.cost(a, effectiveSpan(item, a, C), C), item.id).toBeGreaterThan(0);
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

describe("spans", () => {
  it("offers light online items for life only, and everyday items monthly only", () => {
    expect(spansFor(p("ai"), 10, C)).toEqual(["lifetime"]);
    expect(spansFor(p("car"), 200, C)).toEqual(["monthly"]);
  });

  it("offers past, monthly and lifetime above $100, and hides lifetime above $1,000 unless asked", () => {
    expect(spansFor(p("tv"), 1, C)).toEqual(["past", "monthly", "lifetime"]);
    expect(spansFor(p("ai"), 2000, C)).toEqual(["past", "monthly"]);
    expect(spansFor(p("ai"), 2000, C, true)).toEqual(["past", "monthly", "lifetime"]);
    expect(effectiveSpan(p("ai"), 2000, C, "lifetime")).toBe("monthly");
  });
});

describe("planTotals", () => {
  it("applies one minimum and one fee to one-time items, and $1 a month per monthly item up to the cap", () => {
    const t = planTotals(
      [
        { productId: "ai", amount: 10, span: "lifetime" },
        { productId: "music", amount: 1, span: "lifetime" },
        ...["car", "flights", "transit", "meat", "dairy"].map((id) => ({ productId: id, amount: defaultAmount(p(id), C), span: "monthly" as const })),
      ],
      C,
    );
    expect(t.oneTime!.donation).toBeGreaterThanOrEqual(LIFETIME_MIN_DONATION_USD);
    expect(t.oneTime!.fee).toBe(LIFETIME_FEE_USD);
    expect(t.monthly!.fee).toBe(MAX_FEE_USD);
    expect(t.monthly!.donation).toBeGreaterThan(MIN_DONATION_USD);
  });

  it("leaves out a side with no items", () => {
    const t = planTotals([{ productId: "transit", amount: 1, span: "monthly" }], C);
    expect(t.oneTime).toBeNull();
    expect(t.monthly!.donation).toBe(MIN_DONATION_USD);
  });
});
