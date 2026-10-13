import { describe, expect, it } from "vitest";
import { howEstimated, whereItGoes } from "./methods";
import { coverImpacts, DEFAULT_CONTEXT as C, defaultAmount, effectiveCover, PRODUCTS } from "./store";
import { sumImpacts } from "./footprint";

describe("item info", () => {
  it("explains every item and splits its money across charities", () => {
    for (const p of PRODUCTS) {
      expect(howEstimated(p).length, p.id).toBeGreaterThan(0);
      const a = defaultAmount(p, C) || 1;
      const c = coverImpacts(p, a, effectiveCover(p, a, C), C);
      const goes = whereItGoes(sumImpacts([c.once, c.monthly]));
      expect(goes.length, p.id).toBeGreaterThan(0);
      expect(goes.reduce((s, g) => s + g.share, 0), p.id).toBeGreaterThan(0.98);
      expect(new Set(goes.map((g) => g.charity.name)).size, p.id).toBe(goes.length);
    }
  });
});
