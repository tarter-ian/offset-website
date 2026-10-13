import { describe, expect, it } from "vitest";
import { badges, cleanName, PAST, parsePlanClaim, parseZeroUse, planRows, sameRows, planItems, withZeroUse } from "./publicList";
import { DEFAULT_CONTEXT as C, PRODUCTS } from "./store";

const ID = "abcdef0123456789abcd";
const lines = [
  { productId: "ai", amount: 10, cover: { past: true, ahead: "lifetime" as const } },
  { productId: "car", amount: 200, cover: { past: false, ahead: "monthly" as const } },
];

describe("public list", () => {
  it("works a checkout out again and rejects rows that don't match", () => {
    const input = parsePlanClaim({ planId: ID, billing: "monthly", lines, ctx: C, pastYears: 0, autopay: false })!;
    const rows = planRows(input);
    expect(rows.length).toBeGreaterThan(0);
    expect(sameRows(rows, rows)).toBe(true);
    expect(sameRows(rows, rows.map((r) => ({ ...r, donation: r.donation / 10 })))).toBe(false);
    expect(parsePlanClaim({ planId: ID, billing: "monthly", lines: [{ productId: "nope", amount: 1, cover: { ahead: "monthly" } }], ctx: C })).toBeNull();
    expect(parsePlanClaim({ planId: "bad", billing: "monthly", lines, ctx: C })).toBeNull();
  });
  it("keeps the best current cover per item", () => {
    const now = new Date("2026-10-12T00:00:00Z");
    const month = planItems(lines, "monthly", "2026-10-01T00:00:00.000Z");
    expect(month.find((i) => i.productId === "ai")!.until).toBeNull();
    const old = planItems(lines, "monthly", "2026-01-01T00:00:00.000Z");
    const b = badges(
      [
        { source: "plan", sourceId: "a", rows: [], items: old, createdAt: "2026-01-01" },
        { source: "plan", sourceId: "b", rows: [], items: month, createdAt: "2026-10-01" },
      ],
      now,
    );
    expect(b).toEqual([
      { productId: "ai", until: null, past: true },
      { productId: "car", until: "2026-11-01T00:00:00.000Z" },
    ]);
    expect(badges([{ source: "plan", sourceId: "a", rows: [], items: old.filter((i) => i.productId === "car"), createdAt: "" }], now)).toEqual([]);
  });
  it("leaves a past-use badge when a dated cover ends, only if its past use was paid in full", () => {
    const now = new Date("2026-10-12T00:00:00Z");
    const pastToo = [{ productId: "car", amount: 200, cover: { past: true, ahead: "monthly" as const } }];
    const paid = planItems(pastToo, "monthly", "2026-01-01T00:00:00.000Z");
    expect(paid[0].past).toBe(true);
    expect(planItems(pastToo, "monthly", "2026-01-01T00:00:00.000Z", 3)[0].past).toBeUndefined();
    const claim = (items: typeof paid, id = "a") => ({ source: "plan" as const, sourceId: id, rows: [], items, createdAt: "" });
    expect(badges([claim(paid)], now)).toEqual([{ productId: "car", until: PAST, past: true }]);
    // A cover still running keeps the paid past beside it, from either side: yellow and blue.
    const running = planItems(lines, "monthly", "2026-10-01T00:00:00.000Z").filter((i) => i.productId === "car");
    expect(badges([claim(paid), claim(running, "b")], now)).toEqual([{ productId: "car", until: "2026-11-01T00:00:00.000Z", past: true }]);
    expect(badges([claim(running, "b"), claim(paid)], now)).toEqual([{ productId: "car", until: "2026-11-01T00:00:00.000Z", past: true }]);
  });
  it("pays a lifetime item's past with it, so it reads green, and only a monthly one not spread over years", () => {
    const life = [{ productId: "ai", amount: 10, cover: { past: true, ahead: "lifetime" as const } }];
    expect(planItems(life, "monthly", "2026-10-01T00:00:00.000Z", 3)[0]).toEqual({ productId: "ai", until: null, past: true });
    const noPast = [{ productId: "ai", amount: 10, cover: { past: false, ahead: "lifetime" as const } }];
    expect(planItems(noPast, "monthly", "2026-10-01T00:00:00.000Z")[0]).toEqual({ productId: "ai", until: null });
  });
  it("accepts zero-use items only by name, from the store, once each", () => {
    expect(parseZeroUse(["ai-video", "ai-coding", "ai-video"])).toEqual(["ai-video", "ai-coding"]);
    expect(parseZeroUse([])).toEqual([]);
    expect(parseZeroUse(["ai-video", "made-up"])).toBeNull();
    expect(parseZeroUse([{ productId: "ai-video", amount: 0 }])).toBeNull();
    expect(parseZeroUse({ "ai-video": 0 })).toBeNull();
    expect(parseZeroUse("ai-video")).toBeNull();
    expect(parseZeroUse(Array(200).fill("ai-video"))).toBeNull();
    // Never more than the store holds.
    expect(parseZeroUse(PRODUCTS.map((p) => p.id))!.length).toBe(PRODUCTS.length);
  });
  it("adds zero-use items beside paid badges, never alone, and never over a paid item's own term", () => {
    expect(withZeroUse([], ["ai-video"])).toEqual([]);
    const paid = [
      { productId: "ai", until: null, past: true },
      { productId: "ai-video", until: "2026-11-01T00:00:00.000Z" },
    ];
    expect(withZeroUse(paid, ["ai-video", "ai-coding"])).toEqual([...paid, { productId: "ai-coding", until: null, zero: true }]);
  });
  it("cleans names", () => expect(cleanName("  Ian   T ".padEnd(80, "x"))).toHaveLength(40));
});
