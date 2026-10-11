import * as F from "./factors";
import { aiImpacts, dataCenterImpacts, electronicsMaking, gridImpacts, IMPACT_KEYS, MARGINS, type Impacts } from "./footprint";
import {
  MONTHLY_FEE_USD,
  impactCost,
  LIFETIME_FEE_USD,
  LIFETIME_GROWTH_BUFFER,
  LIFETIME_MIN_DONATION_USD,
  MIN_DONATION_USD,
} from "./pricing";

// One-time offsets for everything someone has done and will do online, sold as
// three items: internet, AI and devices. Past years count at today's rate.
// Future internet use counts at today's rate, on the view that efficiency gains
// in networks and data centers roughly keep pace with growing use; future AI use
// is multiplied by the growth buffer.

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
  aiFromExport?: boolean;
  /** Average energy per prompt measured from an export, in Wh. */
  aiWhPerPrompt?: number;
  /** Your actual AI use to date, measured from exports, in Wh. Replaces the estimate of past use. */
  aiPastWh?: number;
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
const zero: Impacts = { carbon: 0, air: 0, water: 0, land: 0 };
const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);
const part = (impacts: Impacts): LifetimePart => {
  const c = impactCost(impacts, "expected");
  return { impacts, cost: c.carbon + c.air + c.water + c.land };
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
// Above this, a lifetime price is mostly a guess about decades of future use, so we don't offer it.
export const LIFETIME_MAX_USD = 1000;

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
  const pastAi = Math.max(0, year - Math.max(F.AI_START_YEAR, onlineSince));
  const futureYears = Math.max(0, birth + F.LIFETIME_TO_AGE - year);
  // Years of today's use each item covers. Future AI use is counted with the growth buffer.
  const years =
    span === "monthly"
      ? { internet: 1 / 12, ai: 1 / 12, devices: 1 / 12 }
      : span === "past"
        ? { internet: pastInternet, ai: pastAi, devices: pastInternet }
        : span === "future"
          ? { internet: futureYears, ai: futureYears * LIFETIME_GROWTH_BUFFER, devices: futureYears }
          : {
            internet: pastInternet + futureYears,
            ai: pastAi + futureYears * LIFETIME_GROWTH_BUFFER,
            devices: pastInternet + futureYears,
          };

  // Internet: hours a day for each activity, with a wider margin on the rough ones.
  let internet = zero;
  const internetByActivity = {} as Record<InternetActivity, number>;
  for (const k of Object.keys(F.INTERNET_KWH_PER_HOUR) as InternetActivity[]) {
    const kwhPerYear = nonNeg(input.internetHoursPerDay[k]) * 365 * F.INTERNET_KWH_PER_HOUR[k];
    const margin = MARGINS.estimated + (k === "video" ? 0 : F.INTERNET_ROUGH_MARGIN);
    const impacts = add(zero, dataCenterImpacts(kwhPerYear), years.internet * (1 + margin));
    internetByActivity[k] = part(impacts).cost;
    internet = add(internet, impacts);
  }

  // AI: prompts and media, with their share of training, hardware and buildings.
  const aiKwhPerYear =
    ((nonNeg(input.aiPromptsPerDay) * 365 * (input.aiWhPerPrompt ?? F.WH_PER_AI_PROMPT) + nonNeg(input.aiMediaPerWeek) * 52 * F.WH_PER_AI_MEDIA) /
      1000) *
    (1 + (input.aiFromExport ? MARGINS.measured : MARGINS.estimated));
  // Past AI use is measured when an export covers it; otherwise it's today's rate since ChatGPT launched.
  // Only chat is measured, so images stay estimated at today's rate.
  const measuredPast = input.aiPastWh !== undefined;
  const aiPastKwh = measuredPast
    ? (input.aiPastWh! / 1000) * (1 + MARGINS.measured) +
      ((nonNeg(input.aiMediaPerWeek) * 52 * F.WH_PER_AI_MEDIA) / 1000) * (1 + MARGINS.estimated) * pastAi
    : aiKwhPerYear * pastAi;
  const aiKwh =
    span === "past"
      ? aiPastKwh
      : span === "lifetime" && measuredPast
        ? aiPastKwh + aiKwhPerYear * futureYears * LIFETIME_GROWTH_BUFFER
        : aiKwhPerYear * years.ai;
  const ai = aiImpacts(aiKwh);

  // Devices: making each one you'd go through, plus the power to run it.
  let devices = zero;
  for (const k of Object.keys(F.DEVICES) as Device[]) {
    const d = F.DEVICES[k];
    const count = nonNeg(input.devices[k]);
    const madeKg = (count * d.kgToMake * years.devices) / d.yearsKept;
    const made = { ...zero, carbon: madeKg, ...electronicsMaking(madeKg) };
    devices = add(devices, add(made, gridImpacts(count * d.kwhPerYear * years.devices)), 1 + MARGINS.estimated);
  }

  const parts = { internet: part(internet), ai: part(ai), devices: part(devices) };
  const chosen = ITEM_KEYS.filter((k) => items.includes(k));
  const impacts = chosen.reduce((sum, k) => add(sum, parts[k].impacts), zero);
  const raw = chosen.reduce((sum, k) => sum + parts[k].cost, 0);
  // Monthly works like the monthly plan: a $1 minimum and the flat monthly fee.
  const donation =
    span === "monthly"
      ? Math.max(MIN_DONATION_USD, Math.ceil(raw * 100) / 100)
      : Math.max(LIFETIME_MIN_DONATION_USD, Math.ceil(raw));
  const fee = span === "monthly" ? MONTHLY_FEE_USD : LIFETIME_FEE_USD;
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
    total: donation + fee,
  };
}
