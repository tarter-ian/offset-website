import type { Covered } from "./covered";

// What a returning visitor's record page shows: whether anything needs doing,
// and their AI use month by month from the counts the extension keeps on this
// computer. Usage never leaves the computer (Ian, 2026-10-12).

/** Covers still in force: for life, or a period that hasn't ended. */
export const inForce = (c: Covered | undefined, now: number): boolean => !!c && (c.kind === "life" || Date.parse(c.until) > now);

export type RecordStatus =
  /** Nothing has ever been covered here. */
  | { kind: "none" }
  /** Everything covered is covered for life. */
  | { kind: "life" }
  /** Paid by a steady gift that Every.org repeats on its own, with nothing else to do. */
  | { kind: "steady" }
  /** Covered, with nothing to do until the earliest end date. */
  | { kind: "covered"; until: string }
  /** Some monthly or yearly cover has run out: these items are ready to cover again. */
  | { kind: "due"; ids: string[]; ended: string };

/** `steady` lists items a steady gift keeps paying for: they never come due here. */
export function recordStatus(covered: Record<string, Covered>, now: number = Date.now(), steady: string[] = []): RecordStatus {
  const entries = Object.entries(covered);
  if (!entries.length) return { kind: "none" };
  const repeating = entries.filter(([id, c]) => c.kind === "period" && !c.giftFrom && steady.includes(id));
  const periods = entries.filter(
    (e): e is [string, Extract<Covered, { kind: "period" }>] => e[1].kind === "period" && !repeating.some(([id]) => id === e[0]),
  );
  // A gift that ran out isn't the person's to renew, so only their own covers come due.
  const lapsed = periods.filter(([, c]) => !c.giftFrom && Date.parse(c.until) <= now);
  if (lapsed.length) return { kind: "due", ids: lapsed.map(([id]) => id), ended: lapsed.map(([, c]) => c.until).sort()[0] };
  const live = periods.filter(([, c]) => Date.parse(c.until) > now);
  if (live.length) return { kind: "covered", until: live.map(([, c]) => c.until).sort()[0] };
  if (repeating.length) return { kind: "steady" };
  return entries.some(([, c]) => c.kind === "life") ? { kind: "life" } : { kind: "none" };
}

/**
 * Which of `all` are offset right now (for life, a stretch that hasn't ended, or a steady
 * gift that repeats on Every.org), and how many are still open, so the record never says
 * "done" while things are left (Ian, 2026-10-13).
 */
export function offsetCount(
  covered: Record<string, Covered>,
  all: string[],
  now: number = Date.now(),
  steady: string[] = [],
): { offset: string[]; open: number } {
  const offset = all.filter((id) => {
    const c = covered[id];
    return inForce(c, now) || (!!c && c.kind === "period" && !c.giftFrom && steady.includes(id));
  });
  return { offset, open: all.length - offset.length };
}

export const AI_CHAT_SERVICES = ["chatgpt", "claude", "gemini"] as const;
export type AiChatService = (typeof AI_CHAT_SERVICES)[number];

export interface MonthUse {
  /** "YYYY-MM". */
  month: string;
  prompts: Record<AiChatService, number>;
  /** Days with a count, out of the month's days: under the month's length when the extension wasn't counting yet. */
  daysCounted: number;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Prompts per month from the extension's day-by-day record of each AI service
 * (`[{ date: "YYYY-MM-DD", prompts }]`). Months come out oldest first, the last
 * `months` of them that have any count.
 */
export function monthlyUse(records: Partial<Record<AiChatService, unknown>>, months = 8): MonthUse[] {
  const out = new Map<string, MonthUse>();
  const days = new Map<string, Set<string>>();
  for (const s of AI_CHAT_SERVICES) {
    const rec = records[s];
    if (!Array.isArray(rec)) continue;
    for (const d of rec as Record<string, unknown>[]) {
      const date = typeof d?.date === "string" && DAY.test(d.date) ? d.date : "";
      const n = Number(d?.prompts);
      if (!date || !Number.isFinite(n) || n < 0) continue;
      const month = date.slice(0, 7);
      const m = out.get(month) ?? { month, prompts: { chatgpt: 0, claude: 0, gemini: 0 }, daysCounted: 0 };
      m.prompts[s] += n;
      out.set(month, m);
      const seen = days.get(month) ?? new Set<string>();
      seen.add(date);
      days.set(month, seen);
    }
  }
  return [...out.values()]
    .map((m) => ({ ...m, daysCounted: days.get(m.month)?.size ?? 0 }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-months);
}

export const monthTotal = (m: MonthUse) => AI_CHAT_SERVICES.reduce((t, s) => t + m.prompts[s], 0);
