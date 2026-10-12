// Whole-history counts from the extension (0.19.0 and later): with `history: true`,
// YouTube, Netflix and Gemini read as far back as the account goes and return
// `history = { whole, monthly: [{ month: "YYYY-MM", ... }] }`. Only counts per month.

import { NETFLIX_MIN_PER_TITLE } from "./activity";

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
