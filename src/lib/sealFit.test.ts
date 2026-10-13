import { describe, expect, it } from "vitest";
import { FIELD_R, fitSeal, textWidth } from "./sealFit";
import { PRODUCTS, SECTIONS } from "./store";

// "Books, toys and more" replaces "Everything else" (Ian, 2026-10-13); it must fit too.
const NAMES = [...SECTIONS.map((s) => s.title), ...PRODUCTS.map((p) => p.name), "Books, toys and more"];

describe("seal fit", () => {
  it("keeps every name inside the inner ring, at a size that still reads", () => {
    for (const name of NAMES) {
      const l = fitSeal(name);
      expect(l.lines.join(" "), name).toBe(name);
      expect(l.fs, name).toBeGreaterThanOrEqual(10.5);
      l.lines.forEach((line, i) => {
        const half = textWidth(line, l.fs) / 2;
        const dy = Math.max(Math.abs(l.baselines[i] - 0.74 * l.fs - 60), Math.abs(l.baselines[i] + 0.23 * l.fs - 60));
        expect(Math.hypot(half, dy), name).toBeLessThanOrEqual(FIELD_R);
      });
    }
  });
  it("fits every aisle, and Fully Offset, under a mark inside the beaded ring", () => {
    for (const s of [...SECTIONS.map((x) => x.title), "Digital"]) {
      const l = fitSeal(s, { max: 17, field: 33.2, mark: 13 });
      expect(l.mark, s).toBeDefined();
      expect(l.mark! - 6.5, s).toBeGreaterThan(60 - 33.2);
      expect(l.fs, s).toBeGreaterThanOrEqual(11);
    }
    const full = fitSeal("Fully Offset", { tail: false, max: 16, field: 33.2, mark: 9 });
    expect(full.lines).toEqual(["Fully", "Offset"]);
    expect(full.baselines[0] - 0.74 * full.fs).toBeGreaterThan(full.mark! + 4.5);
  });
  it("keeps short names on one line and big", () => {
    expect(fitSeal("AI")).toMatchObject({ lines: ["AI"], fs: 19 });
    expect(fitSeal("Phone").lines).toEqual(["Phone"]);
  });
  it("breaks long names into balanced lines", () => {
    expect(fitSeal("Music and podcasts").lines.length).toBeGreaterThan(1);
    expect(fitSeal("Fully Offset", { tail: false, max: 17 }).lines).toEqual(["Fully", "Offset"]);
  });
});
