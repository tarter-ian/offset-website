// Whole-history counts from the extension (0.19.0 and later): with `history: true`,
// YouTube, Netflix and Gemini read as far back as the account goes and return
// `history = { whole, monthly: [{ month: "YYYY-MM", ... }] }`. DoorDash, Uber Eats
// and Uber send their orders and rides by month on every count.

import { NETFLIX_MIN_PER_TITLE } from "./activity";
import { RIDESHARE_MILES_PER_WEEK } from "./factors";

export interface HistoryTotal {
  total: number;
  /** The earliest month with any count, as "YYYY-MM". */
  firstMonth: string;
  /** False when the count stopped before the end of the history. */
  whole: boolean;
}

const MONTH = /^(\d{4})-(\d{2})$/;

/** Adds one field over every month of a usage's history, or null when there's no history with that field. */
export function historyTotal(usage: unknown, field: string): HistoryTotal | null {
  const h = typeof usage === "object" && usage ? (usage as Record<string, unknown>).history : undefined;
  const monthly = typeof h === "object" && h ? (h as Record<string, unknown>).monthly : undefined;
  if (!Array.isArray(monthly)) return null;
  let total = 0;
  let first = "";
  for (const m of monthly as Record<string, unknown>[]) {
    const month = typeof m?.month === "string" && MONTH.test(m.month) ? m.month : "";
    const n = Number(m?.[field]);
    if (!month || !Number.isFinite(n) || n <= 0) continue;
    total += n;
    if (!first || month < first) first = month;
  }
  if (!first) return null;
  return { total, firstMonth: first, whole: (h as Record<string, unknown>).whole !== false };
}

/** "2022-03" as a year with a fraction, 2022.17. */
export function monthAsYear(month: string): number {
  const m = MONTH.exec(month);
  return m ? Number(m[1]) + (Number(m[2]) - 1) / 12 : NaN;
}

/** "March 2022". */
export function monthName(month: string): string {
  const m = MONTH.exec(month);
  return m ? new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : month;
}

/** Hours of video watched over the whole history: YouTube's own hours, Netflix titles at a typical length each. */
export function videoHistoryHours(service: "youtube" | "netflix", usage: unknown): HistoryTotal | null {
  if (service === "youtube") return historyTotal(usage, "hours");
  const titles = historyTotal(usage, "titles");
  return titles && { ...titles, total: (titles.total * NETFLIX_MIN_PER_TITLE) / 60 };
}

/** Measured video hours to date, and from when: the earliest month any service's history starts. */
export interface VideoPast {
  hours: number;
  since: string;
}

export function combineVideoPast(parts: (HistoryTotal | null | undefined)[]): VideoPast | undefined {
  const got = parts.filter((p): p is HistoryTotal => Boolean(p));
  if (!got.length) return undefined;
  return { hours: got.reduce((s, p) => s + p.total, 0), since: got.map((p) => p.firstMonth).sort()[0] };
}

/**
 * Past use for an everyday card measured from an account's monthly history, in
 * the card's own unit (deliveries, or ride miles), added up by year so the
 * year past use counts from can still be picked.
 */
export interface CardPast {
  byYear: Record<string, number>;
  /** The earliest month with any use, as "YYYY-MM". */
  since: string;
  /** False when the count stopped before the start of the account. */
  whole: boolean;
}

const record = (v: unknown): Record<string, unknown> => (typeof v === "object" && v ? (v as Record<string, unknown>) : {});

/** One field of a usage's monthly history, times `scale`, by year. Null when there's no such history. */
function pastByYear(usage: unknown, field: string, scale: number): CardPast | null {
  const u = record(usage);
  const h = record(u.history);
  if (!Array.isArray(h.monthly) || !(scale >= 0)) return null;
  const byYear: Record<string, number> = {};
  let since = "";
  for (const m of h.monthly as Record<string, unknown>[]) {
    const month = typeof m?.month === "string" && MONTH.test(m.month) ? m.month : "";
    const n = Number(m?.[field]);
    if (!month || !Number.isFinite(n) || n <= 0) continue;
    const y = month.slice(0, 4);
    byYear[y] = (byYear[y] ?? 0) + n * scale;
    if (!since || month < since) since = month;
  }
  if (!since) return null;
  return { byYear, since, whole: h.whole !== false && u.truncated !== true };
}

/**
 * Deliveries to date from DoorDash's or Uber Eats's orders by month. The months
 * don't say which orders were picked up, so the last 30 days' share of
 * deliveries stands in for every month (all of them when there were none).
 */
export function deliveryPast(usage: unknown): CardPast | null {
  const u = record(usage);
  const orders = Number(u.orders) || 0;
  const share = orders > 0 ? Math.min(1, Math.max(0, Number(u.deliveries) || 0) / orders) : 1;
  return pastByYear(usage, "orders", share);
}

/**
 * Ride miles to date from Uber's rides by month, at the last 30 days' miles per
 * ride. With no rides in that time, each counts as the one short ride the
 * card's typical week assumes.
 */
export function ridePast(usage: unknown, typicalMiles = RIDESHARE_MILES_PER_WEEK): CardPast | null {
  const u = record(usage);
  const rides = Number(u.rides) || 0;
  const miles = Number(u.miles) || 0;
  return pastByYear(usage, "rides", rides > 0 && miles > 0 ? miles / rides : typicalMiles);
}

/** Adds the past use of several services on one card, like DoorDash and Uber Eats on food delivery. */
export function combinePast(parts: (CardPast | null | undefined)[]): CardPast | undefined {
  const got = parts.filter((p): p is CardPast => Boolean(p));
  if (!got.length) return undefined;
  const byYear: Record<string, number> = {};
  for (const p of got) for (const [y, n] of Object.entries(p.byYear)) byYear[y] = (byYear[y] ?? 0) + n;
  return { byYear, since: got.map((p) => p.since).sort()[0], whole: got.every((p) => p.whole) };
}

/**
 * What a service's orders or rides cost over its counted days, in US dollars,
 * from extension 0.20.0 on. Null for older versions, other currencies, or Uber
 * when no ride was charged in dollars (its currency is then null). Shown to the person only: the cards it
 * sits beside are priced by deliveries and miles, not dollars.
 */
export function usdSpend(usage: unknown): number | null {
  const u = record(usage);
  const spend = u.spend;
  return typeof spend === "number" && Number.isFinite(spend) && spend >= 0 && u.currency === "USD" ? spend : null;
}
