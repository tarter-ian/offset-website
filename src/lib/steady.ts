import type { ImpactKey } from "./footprint";
import { type Checkout, onceRows, PAYMENT_MODE, type PayRow, repeatRows, sumTotal } from "./payments";
import type { Billing, PaymentMode } from "./pricing";
import { monthTotal, type MonthUse } from "./record";
import { type Context, harmSplit, type PastYears, type PlanLine, planTotals } from "./store";

// Steady autopay is the opt-in mode: the same gift repeats through Every.org, and
// when real use drifts from what it was set for we suggest a top-up or a lower
// gift (Ian, 2026-10-13). All of this is worked out in the browser from the
// extension's counts; usage never goes to the server. Pledge's forms can't
// repeat a gift, so a pledge checkout never has a steady gift.

/** A paid plan with a repeating part: what it was priced from, and when it started. */
export interface SteadyPlan {
  billing: Billing;
  lines: PlanLine[];
  ctx: Context;
  pastYears: PastYears;
  /** When the checkout started, ISO. */
  since: string;
}

/** The person's steady gift, if their checkout repeats on its own and every gift in it is confirmed. */
export function steadyPlan(c: Checkout | null): SteadyPlan | null {
  if (!c?.applied || !c.plan || !c.rows.some((r) => r.frequency !== "ONCE")) return null;
  return { billing: c.billing, lines: c.plan.lines, ctx: c.plan.ctx, pastYears: c.plan.pastYears, since: c.created };
}

/** Items a steady gift keeps paying for, so they never come due on the record page. */
export const steadyIds = (p: SteadyPlan | null) => (p ? p.lines.filter((l) => l.cover.ahead === "monthly").map((l) => l.productId) : []);

/**
 * A charge counts as drifted at more than $5 or 25% from the steady one, whichever
 * comes first: the same limit as the autopay cap (Ian, 2026-10-13).
 */
export const DRIFT_USD = 5;
export const DRIFT_SHARE = 0.25;
/** Fewer counted days than this and a month says too little to go on. */
export const MIN_DAYS = 7;
/** How many whole months to look back over. */
export const RECENT_MONTHS = 3;
/** No big one-time nudges (Ian, 2026-10-13): over this, only raising the steady gift is suggested. */
export const TOPUP_MAX_USD = 100;

export interface CharityChange {
  charity: ImpactKey;
  /** What each charge is now, fee included; 0 for a charity not in the steady gift yet. */
  from: number;
  /** What it would be at measured use; 0 when it would drop out. */
  to: number;
}

export interface Drift {
  kind: "above" | "below";
  /** The whole months measured, "YYYY-MM", oldest first. */
  months: string[];
  /** Prompts a day the steady gift was set for, and what was measured. */
  setFor: number;
  measured: number;
  /** Each charge now and at measured use, fees included. */
  steady: number;
  next: number;
  /** Only the charities whose charge would change. */
  changes: CharityChange[];
  /** One-time gifts that make up the gap for months already past; empty when there's nothing to make up or it's too big to ask at once. */
  topUp: PayRow[];
  /** The months the top-up pays for. */
  topUpMonths: string[];
}

const perDay = (ms: MonthUse[]) => {
  const days = ms.reduce((s, m) => s + m.daysCounted, 0);
  return days ? Math.round((ms.reduce((s, m) => s + monthTotal(m), 0) / days) * 10) / 10 : 0;
};

/**
 * Compares measured AI use since the steady gift started with what it was set
 * for. Null when the plan has no monthly AI chat line, there is no whole month
 * measured since it started, or the charge would move less than the cap allows.
 * `toppedThrough` is the last month a top-up already paid for.
 */
export function steadyDrift(
  plan: SteadyPlan,
  use: MonthUse[],
  { now = Date.now(), toppedThrough, mode = PAYMENT_MODE }: { now?: number; toppedThrough?: string; mode?: PaymentMode } = {},
): Drift | null {
  const ai = plan.lines.find((l) => l.productId === "ai" && l.cover.ahead === "monthly");
  const setFor = Number(ai?.amount);
  if (!ai || !Number.isFinite(setFor)) return null;
  const thisMonth = new Date(now).toISOString().slice(0, 7);
  const start = plan.since.slice(0, 7);
  const months = use.filter((m) => m.month >= start && m.month < thisMonth && m.daysCounted >= MIN_DAYS).slice(-RECENT_MONTHS);
  if (!months.length) return null;

  const priced = (amount: number) => {
    const t = planTotals(
      plan.lines.map((l) => (l === ai ? { ...l, amount } : l)),
      plan.ctx,
      plan.billing,
      plan.pastYears,
    );
    const split = harmSplit(t, plan.ctx, plan.billing);
    return { split, rows: repeatRows(split, plan.billing, mode) };
  };
  const was = priced(setFor);
  const measured = perDay(months);
  const at = priced(measured);
  const steady = sumTotal(was.rows);
  const next = sumTotal(at.rows);
  const room = Math.min(DRIFT_USD, steady * DRIFT_SHARE);
  const kind = next - steady > room ? "above" : steady - next > room ? "below" : null;
  if (!kind) return null;

  const charities = [...new Set([...was.rows, ...at.rows].map((r) => r.charity))];
  const total = (rows: PayRow[], c: ImpactKey) => rows.find((r) => r.charity === c)?.total ?? 0;
  const changes = charities.map((c) => ({ charity: c, from: total(was.rows, c), to: total(at.rows, c) })).filter((c) => Math.abs(c.to - c.from) >= 0.005);

  // The top-up is what each past month's measured use needed, less what the steady gift gave
  // that month, added up per charity. A light month offsets a heavy one; a charity is never
  // paid for another's gap.
  const topUpMonths = kind === "above" ? months.filter((m) => !toppedThrough || m.month > toppedThrough) : [];
  const perMonth = plan.billing === "annual" ? 12 : 1;
  const need: Record<ImpactKey, number> = { carbon: 0, air: 0, water: 0, land: 0, ewaste: 0 };
  for (const m of topUpMonths) {
    const split = priced(perDay([m])).split;
    for (const k of Object.keys(need) as ImpactKey[]) need[k] += split[k].perPeriod / perMonth;
  }
  const gap: Partial<Record<ImpactKey, number>> = {};
  for (const r of at.rows) {
    const given = ((was.rows.find((w) => w.charity === r.charity)?.donation ?? 0) / perMonth) * topUpMonths.length;
    const needed = r.harms.reduce((s, k) => s + need[k], 0);
    if (!(needed - given > 0)) continue;
    for (const k of r.harms) gap[k] = ((needed - given) * need[k]) / needed;
  }
  const rows = onceRows(gap, mode);
  const topUp = rows.length && sumTotal(rows) <= TOPUP_MAX_USD ? rows : [];

  return { kind, months: months.map((m) => m.month), setFor, measured, steady, next, changes, topUp, topUpMonths: topUp.length ? topUpMonths.map((m) => m.month) : [] };
}
