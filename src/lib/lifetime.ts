import * as F from "./factors";
import { monthAsYear } from "./history";
import { aiCoolingWater, aiImpacts, coolingWater, dataCenterImpacts, electronicsMaking, gridImpacts, IMPACT_KEYS, MARGINS, type Impacts } from "./footprint";
import {
  impactCost,
  paymentFee,
  LIFETIME_GROWTH_BUFFER,
  LIFETIME_MIN_DONATION_USD,
  MIN_DONATION_USD,
} from "./pricing";

// One-time offsets for everything someone has done and will do online, sold as
// three items: internet, AI and devices. Past years count at today's rate.
// Future use counts at today's amount of use, powered by a grid that gets cleaner
// each year (see gridYears): carbon and power plant water at one pace, air faster.
// Data center cooling water and land aren't discounted. Future AI use is also
// multiplied by the growth buffer.

export type InternetActivity = keyof typeof F.INTERNET_KWH_PER_HOUR;
export type Device = keyof typeof F.DEVICES;
export type LifetimeItem = "ai" | "internet" | "devices";

export const LIFETIME_ITEMS: Record<LifetimeItem, { label: string; title: string }> = {
  ai: { label: "AI", title: "Offset your lifetime AI use" },
  internet: { label: "Internet", title: "Offset your lifetime internet use" },
  devices: { label: "Devices", title: "Offset your lifetime of devices" },
};
export const ITEM_KEYS = Object.keys(LIFETIME_ITEMS) as LifetimeItem[];

export const INTERNET_ACTIVITIES: Record<InternetActivity, { label: string; hint?: string }> = {
  video: { label: "Video streaming", hint: "YouTube, Netflix, Twitch" },
  social: { label: "Social media", hint: "TikTok, Instagram, Facebook, X" },
  gaming: { label: "Cloud gaming", hint: "Games streamed from a server, like Xbox Cloud or GeForce Now" },
  calls: { label: "Video calls", hint: "Zoom, FaceTime, Teams" },
  music: { label: "Music and podcasts" },
  browsing: { label: "Browsing, email and cloud files" },
};

export const DEVICE_LABELS: Record<Device, string> = {
  phone: "Phones",
  laptop: "Laptops",
  tablet: "Tablets",
  desktop: "Desktop computers",
  tv: "TVs",
  console: "Game consoles",
};

export interface LifetimeInput {
  birthYear: number;
  internetHoursPerDay: Record<InternetActivity, number>;
  aiPromptsPerDay: number;
  aiMediaPerWeek: number;
  /** Short AI videos made a week. */
  aiVideoPerWeek?: number;
  /** Video hours actually watched to date, from YouTube and Netflix history, and the month that history starts ("YYYY-MM"). */
  videoPast?: { hours: number; since: string };
  /** Hours a week with a coding agent such as Claude Code, Codex or Cursor. */
  aiCodingHoursPerWeek?: number;
  /** AI built into other products (search answers, summaries), in typical prompts a day. */
  aiBuiltInPerDay?: number;
  aiFromExport?: boolean;
  /** Average energy per prompt measured from an export, in Wh. */
  aiWhPerPrompt?: number;
  /** Your actual AI use to date, measured from exports or chat history, in Wh. Replaces the estimate of past use. */
  aiPastWh?: number;
  /** When you started using AI, if you said. Unmeasured past use counts from here (never before ChatGPT's launch). */
  aiStartYear?: number;
  /** How many of each device you use at a time. */
  devices: Record<Device, number>;
}

export const DEFAULT_LIFETIME_INPUT: LifetimeInput = {
  birthYear: 1995,
  internetHoursPerDay: { video: 2, social: 1, gaming: 0, calls: 0.25, music: 1, browsing: 2 },
  aiPromptsPerDay: 10,
  aiMediaPerWeek: 0,
  devices: { phone: 1, laptop: 1, tablet: 0, desktop: 0, tv: 1, console: 0 },
};

export interface LifetimePart {
  impacts: Impacts;
  /** Unrounded donation for this part alone. */
  cost: number;
}

export interface LifetimeOffset {
  span: Span;
  items: LifetimeItem[];
  parts: Record<LifetimeItem, LifetimePart>;
  /** Unrounded donation per internet activity. */
  internetByActivity: Record<InternetActivity, number>;
  pastYears: { internet: number; ai: number };
  futureYears: number;
  /** Total impacts covered, estimate plus margin and buffer. */
  impacts: Impacts;
  donation: number;
  fee: number;
  total: number;
}

const add = (a: Impacts, b: Impacts, k = 1): Impacts =>
  Object.fromEntries(IMPACT_KEYS.map((x) => [x, a[x] + b[x] * k])) as Impacts;
const zero: Impacts = { carbon: 0, air: 0, water: 0, land: 0, ewaste: 0 };
const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const part = (impacts: Impacts): LifetimePart => {
  const c = impactCost(impacts, "expected");
  return { impacts, cost: c.carbon + c.air + c.water + c.land + c.ewaste };
};

/** Parses a `cover` value such as "ai" or "internet,devices"; anything else means all items. */
export function parseItems(value?: string): LifetimeItem[] {
  const items = (value ?? "").split(",").filter((v): v is LifetimeItem => v in LIFETIME_ITEMS);
  return items.length ? ITEM_KEYS.filter((k) => items.includes(k)) : ITEM_KEYS;
}

/** How much of someone's use an offset covers. "future" is lifetime without the years already past. */
export type Span = "past" | "monthly" | "lifetime" | "future";

export const SPANS: Record<Span, { label: string; badge: string; per: string; hint: string }> = {
  past: { label: "Past use", badge: "to date", per: "once", hint: "Everything up to today, in one payment." },
  monthly: { label: "Ongoing", badge: "each year", per: "a year", hint: "Your use as it happens, billed yearly or monthly. Cancel anytime." },
  lifetime: { label: "Lifetime", badge: "for life", per: "once", hint: "Everything so far and everything to come, in one payment." },
  future: { label: "Lifetime", badge: "all future use", per: "once", hint: "Everything from today on, in one payment." },
};
export const SPAN_KEYS = Object.keys(SPANS) as Span[];
// Lifetime prices above this get the choice of past use or monthly; lighter users just see lifetime.
export const SPAN_CHOICE_ABOVE_USD = 100;
// Above this, lifetime is hidden behind "show lifetime anyway": few people give more than $100-400 at once (Ian, 2026-10-12).
export const LIFETIME_MAX_USD = 400;

export function lifetimeOffset(
  input: LifetimeInput,
  items: LifetimeItem[] = ITEM_KEYS,
  now = new Date(),
  span: Span = "lifetime",
): LifetimeOffset {
  const year = now.getFullYear() + now.getMonth() / 12;
  const birth = Math.min(Math.max(input.birthYear || 1990, 1900), year);
  const onlineSince = Math.max(birth + F.ONLINE_FROM_AGE, F.INTERNET_START_YEAR);
  const pastInternet = Math.max(0, year - onlineSince);
  const pastAi = Math.max(0, year - Math.max(F.AI_START_YEAR, input.aiStartYear ?? 0, onlineSince));
  const futureYears = Math.max(0, birth + F.LIFETIME_TO_AGE - year);
  // Years counted at today's rates (past use, or a month of ongoing use) and years still to come.
  const plain = (past: number) => (span === "monthly" ? 1 / 12 : span === "future" ? 0 : past);
  const ahead = span === "lifetime" || span === "future" ? futureYears : 0;
  const power = F.gridYears(year, ahead);
  const air = F.gridYears(year, ahead, F.GRID_AIR_CLEANER_PER_YEAR);
  // A year of use, repeated over the years ahead on a grid getting cleaner. Cooling water is the part that isn't power.
  const future = (perYear: Impacts, cooling = 0): Impacts => ({
    carbon: perYear.carbon * power,
    air: perYear.air * air,
    water: (perYear.water - cooling) * power + cooling * ahead,
    land: perYear.land * ahead,
    ewaste: perYear.ewaste * ahead,
  });

  // Internet: hours a day for each activity, with a wider margin on the rough ones.
  let internet = zero;
  const internetByActivity = {} as Record<InternetActivity, number>;
  for (const k of Object.keys(F.INTERNET_KWH_PER_HOUR) as InternetActivity[]) {
    const kwhPerYear = nonNeg(input.internetHoursPerDay[k]) * 365 * F.INTERNET_KWH_PER_HOUR[k];
    const margin = MARGINS.estimated + (k === "video" ? 0 : F.INTERNET_ROUGH_MARGIN);
    const perYear = dataCenterImpacts(kwhPerYear);
    // Measured video history replaces the estimate of past watching; years before the history starts are estimated at today's hours.
    const measured = k === "video" && input.videoPast && (span === "past" || span === "lifetime") ? input.videoPast : undefined;
    const past = measured
      ? dataCenterImpacts(
          (nonNeg(measured.hours) + nonNeg(input.internetHoursPerDay.video) * 365 * Math.max(0, (monthAsYear(measured.since) || year) - onlineSince)) *
            F.INTERNET_KWH_PER_HOUR.video,
        )
      : zero;
    const used = add(add(past, perYear, measured ? 0 : plain(pastInternet)), future(perYear, coolingWater(kwhPerYear)));
    const impacts = add(zero, used, 1 + margin);
    internetByActivity[k] = part(impacts).cost;
    internet = add(internet, impacts);
  }

  // AI: prompts and media, with their share of training, hardware and buildings.
  const aiKwhPerYear =
    ((nonNeg(input.aiPromptsPerDay) * 365 * (input.aiWhPerPrompt ?? F.WH_PER_AI_PROMPT) + nonNeg(input.aiMediaPerWeek) * 52 * F.WH_PER_AI_MEDIA) /
      1000) *
    (1 + (input.aiFromExport ? MARGINS.measured : MARGINS.estimated));
  // Video and AI built into other products are estimated, and only began in 2024.
  const videoKwhPerYear = ((nonNeg(input.aiVideoPerWeek ?? 0) * 52 * F.WH_PER_AI_VIDEO) / 1000) * (1 + MARGINS.estimated);
  const codingKwhPerYear = ((nonNeg(input.aiCodingHoursPerWeek ?? 0) * 52 * F.WH_PER_CLAUDE_CODE_HOUR) / 1000) * (1 + MARGINS.estimated);
  const builtInKwhPerYear = ((nonNeg(input.aiBuiltInPerDay ?? 0) * 365 * F.WH_PER_AI_PROMPT) / 1000) * (1 + MARGINS.estimated);
  const yearsSince = (start: number) => Math.max(0, year - Math.max(start, onlineSince));
  // Past AI use is measured when an export or chat history covers it; otherwise it grows
  // steadily from when you started to today's rate. Only chat is measured, so images are estimated.
  const aiPastKwh =
    (input.aiPastWh !== undefined
      ? (input.aiPastWh / 1000) * (1 + MARGINS.measured) +
        ((nonNeg(input.aiMediaPerWeek) * 52 * F.WH_PER_AI_MEDIA) / 1000) * (1 + MARGINS.estimated) * pastAi * F.AI_PAST_RAMP
      : aiKwhPerYear * pastAi * F.AI_PAST_RAMP) +
    videoKwhPerYear * yearsSince(Math.max(F.AI_VIDEO_START_YEAR, input.aiStartYear ?? 0)) * F.AI_PAST_RAMP +
    codingKwhPerYear * yearsSince(Math.max(F.AI_CODING_START_YEAR, input.aiStartYear ?? 0)) * F.AI_PAST_RAMP +
    builtInKwhPerYear * yearsSince(F.AI_BUILT_IN_START_YEAR);
  const aiYearKwh = aiKwhPerYear + videoKwhPerYear + codingKwhPerYear + builtInKwhPerYear;
  const aiPlainKwh = span === "monthly" ? aiYearKwh / 12 : span === "future" ? 0 : aiPastKwh;
  const ai = add(aiImpacts(aiPlainKwh), future(aiImpacts(aiYearKwh), aiCoolingWater(aiYearKwh)), LIFETIME_GROWTH_BUFFER);

  // Devices: making each one you'd go through, plus the power to run it.
  // Making them isn't on the US grid, so it counts every year in full.
  let devices = zero;
  for (const k of Object.keys(F.DEVICES) as Device[]) {
    const d = F.DEVICES[k];
    const count = nonNeg(input.devices[k]);
    const madeKg = (count * d.kgToMake * (plain(pastInternet) + ahead)) / d.yearsKept;
    const thrownKg = (count * d.kgWeight * (plain(pastInternet) + ahead)) / d.yearsKept;
    const made = { ...zero, carbon: madeKg, ...electronicsMaking(madeKg), ewaste: thrownKg };
    const running = gridImpacts(count * d.kwhPerYear);
    const used = add(add(made, running, plain(pastInternet)), future(running));
    devices = add(devices, used, 1 + MARGINS.estimated);
  }

  const parts = { internet: part(internet), ai: part(ai), devices: part(devices) };
  const chosen = ITEM_KEYS.filter((k) => items.includes(k));
  const impacts = chosen.reduce((sum, k) => add(sum, parts[k].impacts), zero);
  const raw = chosen.reduce((sum, k) => sum + parts[k].cost, 0);
  // Monthly works like the monthly plan: a $1 minimum. Either way the fee is the payment's card cost.
  const donation =
    span === "monthly"
      ? Math.max(MIN_DONATION_USD, Math.ceil(raw * 100) / 100)
      : Math.max(LIFETIME_MIN_DONATION_USD, Math.ceil(raw));
  const fee = paymentFee(donation);
  return {
    span,
    items: chosen,
    parts,
    internetByActivity,
    pastYears: { internet: pastInternet, ai: pastAi },
    futureYears,
    impacts,
    donation,
    fee,
    total: Math.round((donation + fee) * 100) / 100,
  };
}
