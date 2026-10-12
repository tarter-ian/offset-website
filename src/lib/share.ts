import * as F from "./factors";
import { aiImpacts } from "./footprint";
import { IMPACT_INFO } from "./impacts";
import type { Context } from "./store";

// The share card: a month of someone's AI use, as totals only. Nothing in the
// link says who they are or what they asked.

export interface ShareTotals {
  /** kg CO2e in a month. */
  carbon: number;
  /** Minutes of healthy life lost to air pollution in a month. */
  lifeMinutes: number;
}

/** Highest values a link may carry; anything above is clamped. Far beyond any one person's month. */
export const SHARE_MAX = { carbon: 10_000, lifeMinutes: 100_000 } as const;

const clamp = (v: unknown, max: number): number => {
  const n = typeof v === "string" && /^\s*\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
};

/** Reads `c` (kg CO2e) and `m` (minutes of life) from a query, ignoring anything else. Bad values become 0. */
export function parseShare(params: Record<string, string | string[] | undefined> | URLSearchParams): ShareTotals {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    return Array.isArray(v) ? v[0] : (v ?? undefined);
  };
  return { carbon: clamp(get("c"), SHARE_MAX.carbon), lifeMinutes: clamp(get("m"), SHARE_MAX.lifeMinutes) };
}

/** Rounds totals for a link, so it carries no more precision than the card shows. */
export function shareQuery(t: ShareTotals): string {
  const fit = (n: number, max: number) => {
    const v = Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0;
    return String(v >= 10 ? Math.round(v) : Math.round(v * 100) / 100);
  };
  return new URLSearchParams({ c: fit(t.carbon, SHARE_MAX.carbon), m: fit(t.lifeMinutes, SHARE_MAX.lifeMinutes) }).toString();
}

/**
 * A month of AI use, best estimate without our margin: prompts at the person's
 * measured energy (which includes Claude Code and agents when linked), images,
 * video, hours of coding agents entered by hand, and the AI built into search and other apps.
 */
export function aiMonthTotals(amounts: { prompts: number; images: number; videos: number; codingHours?: number }, ctx: Pick<Context, "aiWhPerPrompt">): ShareTotals {
  const n = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
  const wh =
    n(amounts.prompts) * F.DAYS_PER_MONTH * (ctx.aiWhPerPrompt ?? F.WH_PER_AI_PROMPT) +
    n(amounts.images) * F.WEEKS_PER_MONTH * F.WH_PER_AI_MEDIA +
    n(amounts.videos) * F.WEEKS_PER_MONTH * F.WH_PER_AI_VIDEO +
    n(amounts.codingHours ?? 0) * F.WEEKS_PER_MONTH * F.WH_PER_CLAUDE_CODE_HOUR +
    F.AI_BUILT_IN_PROMPTS_PER_DAY * F.DAYS_PER_MONTH * F.WH_PER_AI_PROMPT;
  const i = aiImpacts(wh / 1000);
  return { carbon: i.carbon, lifeMinutes: i.air * F.MINUTES_OF_LIFE_PER_DAMAGE_USD };
}

/** The card's two figures as text, e.g. "1.2 kg CO₂e" and "3 sec". */
export function shareLines(t: ShareTotals) {
  return {
    carbon: IMPACT_INFO.carbon.format(t.carbon),
    life: IMPACT_INFO.air.format(t.lifeMinutes / F.MINUTES_OF_LIFE_PER_DAMAGE_USD).replace(/ of life$/, ""),
  };
}
