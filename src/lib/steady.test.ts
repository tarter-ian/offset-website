import { describe, expect, it } from "vitest";
import type { Checkout } from "./payments";
import { sumTotal } from "./payments";
import type { MonthUse } from "./record";
import { type SteadyPlan, steadyDrift, steadyIds, steadyPlan, TOPUP_MAX_USD } from "./steady";
import { DEFAULT_CONTEXT, type PlanLine } from "./store";

const NOW = Date.parse("2026-10-13T12:00:00Z");
// Heavy reasoning use, so AI chat costs enough per month to move a charge past the $1 smallest gift.
const CTX = { ...DEFAULT_CONTEXT, aiWhPerPrompt: 200 };
const aiLine = (amount: number): PlanLine => ({ productId: "ai", amount, cover: { past: false, ahead: "monthly" } });
const plan = (amount: number, extra: Partial<SteadyPlan> = {}): SteadyPlan => ({
  billing: "monthly",
  lines: [aiLine(amount)],
  ctx: CTX,
  pastYears: 0,
  since: "2026-07-03T10:00:00Z",
  ...extra,
});
const month = (m: string, perDay: number, days = 30): MonthUse => ({ month: m, prompts: { chatgpt: perDay * days, claude: 0, gemini: 0 }, daysCounted: days });

describe("steadyPlan", () => {
  const base: Checkout = {
    id: "abcdef123456",
    created: "2026-07-03T10:00:00Z",
    billing: "monthly",
    rows: [{ key: "carbon-repeat", charity: "carbon", harms: ["carbon", "air"], donation: 2, fee: 0.34, total: 2.34, frequency: "MONTHLY" }],
    lines: [{ productId: "ai", lifetime: false }],
    done: {},
    confirmed: { "carbon-repeat": true },
    applied: true,
    plan: { lines: [aiLine(20)], ctx: CTX, pastYears: 0 },
  };
  it("is the plan once a repeating checkout is confirmed", () => {
    expect(steadyPlan(base)).toEqual({ billing: "monthly", lines: [aiLine(20)], ctx: CTX, pastYears: 0, since: base.created });
    expect(steadyIds(steadyPlan(base))).toEqual(["ai"]);
  });
  it("is null without autopay, before every gift is confirmed, or without what it was priced from", () => {
    expect(steadyPlan(null)).toBeNull();
    expect(steadyPlan({ ...base, rows: base.rows.map((r) => ({ ...r, frequency: "ONCE" as const })) })).toBeNull();
    expect(steadyPlan({ ...base, applied: undefined })).toBeNull();
    expect(steadyPlan({ ...base, plan: undefined })).toBeNull();
    expect(steadyIds(null)).toEqual([]);
  });
});

describe("steadyDrift", () => {
  it("shows nothing without a monthly AI line or a whole month measured since the gift started", () => {
    expect(steadyDrift(plan(20, { lines: [{ ...aiLine(20), cover: { past: false, ahead: "lifetime" } }] }), [month("2026-09", 80)], { now: NOW })).toBeNull();
    expect(steadyDrift(plan(20), [], { now: NOW })).toBeNull();
    // Before the gift started, this month so far, and a month with too few days counted don't count.
    expect(steadyDrift(plan(20), [month("2026-06", 80), month("2026-09", 80, 3), month("2026-10", 80)], { now: NOW })).toBeNull();
  });

  it("shows nothing when the charge would move less than $5 or 25%", () => {
    expect(steadyDrift(plan(20), [month("2026-08", 22), month("2026-09", 21)], { now: NOW })).toBeNull();
  });

  it("suggests a top-up and a higher gift when use runs above", () => {
    const d = steadyDrift(plan(20), [month("2026-08", 40), month("2026-09", 40)], { now: NOW })!;
    expect(d.kind).toBe("above");
    expect(d.months).toEqual(["2026-08", "2026-09"]);
    expect([d.setFor, d.measured]).toEqual([20, 40]);
    expect(d.next).toBeGreaterThan(d.steady);
    // Only the charity whose charge moves is listed; water stays at the $1 smallest gift.
    expect(d.changes.map((c) => c.charity)).toEqual(["carbon"]);
    expect(d.changes[0].to).toBeGreaterThan(d.changes[0].from);
    // Two months of the carbon gap, one-time.
    expect(d.topUp.map((r) => [r.charity, r.frequency])).toEqual([["carbon", "ONCE"]]);
    const gap = d.changes[0].to - d.changes[0].from;
    expect(d.topUp[0].donation).toBeGreaterThan(2 * gap * 0.85);
    expect(d.topUp[0].donation).toBeLessThan(2 * gap * 1.15);
    expect(d.topUpMonths).toEqual(["2026-08", "2026-09"]);
  });

  it("doesn't top up a month already topped up", () => {
    const d = steadyDrift(plan(20), [month("2026-08", 40), month("2026-09", 40)], { now: NOW, toppedThrough: "2026-08" })!;
    expect(d.topUpMonths).toEqual(["2026-09"]);
    const both = steadyDrift(plan(20), [month("2026-08", 40), month("2026-09", 40)], { now: NOW })!;
    expect(d.topUp[0].donation).toBeCloseTo(both.topUp[0].donation / 2, 1);
    expect(steadyDrift(plan(20), [month("2026-08", 40), month("2026-09", 40)], { now: NOW, toppedThrough: "2026-09" })!.topUp).toEqual([]);
  });

  it("lets a light month offset a heavy one in the top-up", () => {
    const evenOut = steadyDrift(plan(20), [month("2026-08", 60), month("2026-09", 20)], { now: NOW })!;
    const one = steadyDrift(plan(20), [month("2026-09", 60)], { now: NOW })!;
    expect(evenOut.kind).toBe("above");
    expect(evenOut.topUp[0].donation).toBeCloseTo(one.topUp[0].donation, 1);
  });

  it("never asks for a big one-time gift, only a higher steady one", () => {
    const d = steadyDrift(plan(10), [month("2026-07", 400), month("2026-08", 400), month("2026-09", 400)], { now: NOW })!;
    expect(d.kind).toBe("above");
    expect(d.topUp).toEqual([]);
    expect(d.topUpMonths).toEqual([]);
    expect(d.next - d.steady).toBeGreaterThan(TOPUP_MAX_USD / 3);
  });

  it("suggests a lower gift, with no top-up, when use runs below", () => {
    const d = steadyDrift(plan(80), [month("2026-08", 20), month("2026-09", 20)], { now: NOW })!;
    expect(d.kind).toBe("below");
    expect(d.next).toBeLessThan(d.steady);
    expect(d.changes.find((c) => c.charity === "carbon")!.to).toBeLessThan(d.changes.find((c) => c.charity === "carbon")!.from);
    expect(d.topUp).toEqual([]);
  });

  it("compares a yearly gift by the year", () => {
    const d = steadyDrift(plan(20, { billing: "annual" }), [month("2026-08", 40), month("2026-09", 40)], { now: NOW })!;
    expect(d.kind).toBe("above");
    // Two months of a yearly gap is a sixth of the year's.
    const gap = d.changes.find((c) => c.charity === "carbon")!;
    expect(sumTotal(d.topUp)).toBeLessThan((gap.to - gap.from) / 4);
  });

  it("uses only the last three whole months", () => {
    const d = steadyDrift(plan(20), [month("2026-06", 40), month("2026-07", 40), month("2026-08", 40), month("2026-09", 40)], { now: NOW })!;
    expect(d.months).toEqual(["2026-07", "2026-08", "2026-09"]);
  });
});
