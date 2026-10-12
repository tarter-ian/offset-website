import { describe, expect, it } from "vitest";
import { badges, cleanName, parsePlanClaim, planRows, sameRows, planItems } from "./publicList";
import { DEFAULT_CONTEXT as C } from "./store";

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
      { productId: "ai", until: null },
      { productId: "car", until: "2026-11-01T00:00:00.000Z" },
    ]);
    expect(badges([{ source: "plan", sourceId: "a", rows: [], items: old.filter((i) => i.productId === "car"), createdAt: "" }], now)).toEqual([]);
  });
  it("cleans names", () => expect(cleanName("  Ian   T ".padEnd(80, "x"))).toHaveLength(40));
});
