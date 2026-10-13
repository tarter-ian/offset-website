import * as F from "./factors";
import { STATES, type StateCode } from "./data/states";
import { aiImpacts, computeFootprint, IMPACT_KEYS, dataCenterImpacts, DEFAULT_ANSWERS, gridImpacts, sumImpacts, type Impacts, type Answers, type CategoryKey, type Diet, type Shopping } from "./footprint";
import {
  DEFAULT_LIFETIME_INPUT,
  LIFETIME_MAX_USD,
  lifetimeOffset,
  type Device,
  type InternetActivity,
  type LifetimeInput,
  type Span,
} from "./lifetime";
import type { ProviderId } from "./providers";
import type { AiLevel } from "./ai/levels";
import type { CodeEstimate, UsageSummary } from "./ai/exportParser";
import {
  type Billing,
  DEFAULT_BILLING,
  impactCost,
  paymentFee,
  LIFETIME_MIN_DONATION_USD,
  type Recurring,
  recurringPrice,
} from "./pricing";

// The storefront: each part of someone's life is an item they can offset on its
// own, priced from their amount. Online items can be covered for life, to date or
// ongoing; everyday items are ongoing, billed yearly or monthly. Minimums and fees
// apply to the whole plan.

export type SectionKey = "ai" | "online" | "devices" | "home" | "travel" | "food" | "shopping";

export const SECTIONS: { key: SectionKey; title: string; blurb: string }[] = [
  { key: "ai", title: "AI", blurb: "The cost of every prompt, image and video, and the models behind them." },
  { key: "online", title: "Online", blurb: "The data centers and networks behind what you watch, play and scroll." },
  { key: "devices", title: "Devices", blurb: "Making and running the things you use them on." },
  { key: "home", title: "Home", blurb: "Your power and heat, month by month." },
  { key: "travel", title: "Travel", blurb: "Driving, flying and getting around." },
  { key: "food", title: "Food", blurb: "What it takes to grow and raise what you eat." },
  { key: "shopping", title: "Shopping", blurb: "Making the things and services you buy." },
];

export interface Context {
  birthYear: number;
  state: StateCode;
  /** Set once the person picks a state, so a guess from their location never overrides it. */
  statePicked?: boolean;
  /** Measured from a linked AI account. */
  aiWhPerPrompt?: number;
  aiFromExport?: boolean;
  /** All-time AI chat energy from linked exports or chat history, in Wh. */
  aiPastWh?: number;
  /** Claude Code energy estimated from a Claude plan's weekly limit, which the prompt count leaves out. */
  aiCode?: CodeEstimate;
  /** ChatGPT's agent and Codex tools, from their token totals. */
  aiAgent?: UsageSummary["agent"];
  /** The year the person says they started using AI. */
  aiStartYear?: number;
  /** A quick AI estimate: a picked level, or the plan from a sign-in. */
  aiEstimate?: { level?: AiLevel; from: string };
  /** Coding energy to date, from ChatGPT's agent and Codex token totals and Claude's weekly limit, in Wh. */
  aiCodingPastWh?: number;
  /**
   * Habits that changed: what an everyday item was before a year, like meat at most meals
   * until going vegan. Past use before that year is priced at the old habit.
   */
  before?: Record<string, Before>;
  /** Video hours watched to date, from YouTube and Netflix whole history. */
  videoPast?: { hours: number; since: string };
  /** The year everyday items' past use counts from, when the person picks one. */
  pastSinceYear?: number;
}

export interface Before {
  amount: number | string;
  /** The year the habit changed. */
  until: number;
}

export const DEFAULT_CONTEXT: Context = { birthYear: DEFAULT_LIFETIME_INPUT.birthYear, state: DEFAULT_ANSWERS.state };

/** Everyday items' past use counts from this age unless the person picks a year (Ian, 2026-10-12). */
export const PAST_FROM_AGE = 18;
export const everydaySince = (ctx: Context) => ctx.pastSinceYear ?? ctx.birthYear + PAST_FROM_AGE;
/**
 * Months of past use for everyday items, from the start of that year to now, at
 * today's habits. That likely undercounts: cars and the grid were dirtier then.
 */
export const everydayPastMonths = (ctx: Context, now = new Date()) =>
  Math.max(0, (now.getFullYear() - everydaySince(ctx)) * 12 + now.getMonth());

type Amount =
  | { kind: "number"; label: string; unit: string; default: number; step: number; prefix?: string }
  | { kind: "choice"; label: string; default: string; options: { value: string; label: string }[] };

export interface Product {
  id: string;
  section: SectionKey;
  name: string;
  blurb: string;
  amount: Amount;
  /** Online items can be paid once; everyday items are monthly. */
  oneTime: boolean;
  /** Donation before minimums and fees, for this amount over the span. */
  cost: (amount: number | string, span: Span, ctx: Context) => number;
  /** Everything covered for this amount over the span (estimate plus margin); a month for ongoing items. */
  impacts: (amount: number | string, span: Span, ctx: Context) => Impacts;
  /** Best-estimate greenhouse gases for a year of this amount, in kg CO2e, without our safety margin. */
  kgPerYear: (amount: number | string, ctx: Context) => number;
}

const NO_ONLINE: Record<InternetActivity, number> = { video: 0, social: 0, gaming: 0, calls: 0, music: 0, browsing: 0 };
const NO_DEVICES: Record<Device, number> = { phone: 0, laptop: 0, tablet: 0, desktop: 0, tv: 0, console: 0 };
const base = (ctx: Context): LifetimeInput => ({
  ...DEFAULT_LIFETIME_INPUT,
  birthYear: ctx.birthYear,
  aiStartYear: ctx.aiStartYear,
  videoPast: ctx.videoPast,
  internetHoursPerDay: NO_ONLINE,
  aiPromptsPerDay: 0,
  aiMediaPerWeek: 0,
  devices: NO_DEVICES,
});
const num = (v: number | string) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

const costOf = (i: Impacts) => {
  const c = impactCost(i);
  return c.carbon + c.air + c.water + c.land + c.ewaste;
};

function onlineItem(id: InternetActivity, name: string, blurb: string, hours: number): Product {
  const online = (a: number | string, span: Span, ctx: Context) =>
    lifetimeOffset({ ...base(ctx), internetHoursPerDay: { ...NO_ONLINE, [id]: num(a) } }, ["internet"], undefined, span).parts.internet
      .impacts;
  return {
    id,
    section: "online",
    name,
    blurb,
    amount: { kind: "number", label: `${name} hours a day`, unit: "hours a day", default: hours, step: 0.25 },
    oneTime: true,
    cost: (a, span, ctx) => costOf(online(a, span, ctx)),
    impacts: (a, span, ctx) => online(a, span, ctx),
    kgPerYear: (a) => dataCenterImpacts(num(a) * 365 * F.INTERNET_KWH_PER_HOUR[id]).carbon,
  };
}

function deviceItem(id: Device, name: string, blurb: string, count: number): Product {
  const device = (a: number | string, span: Span, ctx: Context) =>
    lifetimeOffset({ ...base(ctx), devices: { ...NO_DEVICES, [id]: Math.round(num(a)) } }, ["devices"], undefined, span).parts.devices
      .impacts;
  return {
    id,
    section: "devices",
    name,
    blurb,
    amount: { kind: "number", label: `${name} you use`, unit: "in use", default: count, step: 1 },
    oneTime: true,
    cost: (a, span, ctx) => costOf(device(a, span, ctx)),
    impacts: (a, span, ctx) => device(a, span, ctx),
    kgPerYear: (a) => {
      const n = Math.round(num(a));
      const d = F.DEVICES[id];
      return (n * d.kgToMake) / d.yearsKept + gridImpacts(n * d.kwhPerYear).carbon;
    },
  };
}

/** A month of one category of the footprint, estimate plus margin. */
function monthly(key: CategoryKey | CategoryKey[], answers: Answers): Impacts {
  const keys = Array.isArray(key) ? key : [key];
  return sumImpacts(
    computeFootprint(answers)
      .categories.filter((c) => keys.includes(c.key))
      .map((c) => c.offset),
  );
}

/**
 * An everyday item's impacts over a span, from one month at today's habits.
 * Past use repeats that month back to the start year; the years ahead repeat it
 * to age 85, with home power on a grid getting cleaner as online items assume.
 * Lifetime for everyday items is a guess about habits decades out, so it's only
 * shown when asked for (Ian, 2026-10-12).
 */
function everydaySpan(m: Impacts, span: Span, ctx: Context, keys: CategoryKey | CategoryKey[], now = new Date()): Impacts {
  if (span === "monthly") return m;
  const pastMonths = span === "past" || span === "lifetime" ? everydayPastMonths(ctx, now) : 0;
  const year = now.getFullYear() + now.getMonth() / 12;
  const ahead = span === "future" || span === "lifetime" ? Math.max(0, ctx.birthYear + F.LIFETIME_TO_AGE - year) : 0;
  const grid = (Array.isArray(keys) ? keys : [keys]).includes("electricity");
  const power = grid ? F.gridYears(year, ahead) : ahead;
  const air = grid ? F.gridYears(year, ahead, F.GRID_AIR_CLEANER_PER_YEAR) : ahead;
  return {
    carbon: m.carbon * (pastMonths + 12 * power),
    air: m.air * (pastMonths + 12 * air),
    water: m.water * (pastMonths + 12 * power),
    land: m.land * (pastMonths + 12 * ahead),
    ewaste: m.ewaste * (pastMonths + 12 * ahead),
  };
}

function lifeItem(
  id: string,
  section: SectionKey,
  name: string,
  blurb: string,
  amount: Amount,
  answers: (a: number | string, ctx: Context) => Partial<Answers>,
  keys: CategoryKey | CategoryKey[],
): Product {
  const month = (a: number | string, ctx: Context) => monthly(keys, { ...DEFAULT_ANSWERS, state: ctx.state, ...answers(a, ctx) });
  const impacts = (a: number | string, span: Span, ctx: Context): Impacts => {
    const now = month(a, ctx);
    const used = everydaySpan(now, span, ctx, keys);
    const b = ctx.before?.[id];
    if (!b || (span !== "past" && span !== "lifetime")) return used;
    // The months before the habit changed are priced at the old habit instead.
    const months = Math.min(everydayPastMonths(ctx), Math.max(0, (b.until - everydaySince(ctx)) * 12));
    const then = month(b.amount, ctx);
    return Object.fromEntries(IMPACT_KEYS.map((k) => [k, Math.max(0, used[k] + (then[k] - now[k]) * months)])) as Impacts;
  };
  return {
    id,
    section,
    name,
    blurb,
    amount,
    oneTime: false,
    cost: (a, span, ctx) => costOf(impacts(a, span, ctx)),
    impacts: (a, span, ctx) => impacts(a, span, ctx),
    kgPerYear: (a, ctx) => {
      const ks = Array.isArray(keys) ? keys : [keys];
      const f = computeFootprint({ ...DEFAULT_ANSWERS, state: ctx.state, ...answers(a, ctx) });
      return 12 * f.categories.filter((c) => ks.includes(c.key)).reduce((sum, c) => sum + c.impacts.carbon, 0);
    },
  };
}

const DIET_IDS = ["meat", "dairy", "plants"];
/** Everyday items whose habit can have changed, and the items that change with it: one diet sets all three food cards. */
export const BEFORE_GROUPS: Record<string, string[]> = { meat: DIET_IDS, dairy: DIET_IDS, plants: DIET_IDS, car: ["car"], flights: ["flights"] };

/**
 * A card a lifestyle choice covers, like meat on a vegan diet (Ian, 2026-10-12).
 * Only for choices that leave nothing to pay going forward.
 */
export function lifestyleBadge(p: Product, amount: number | string): string | null {
  if (p.id === "meat" && (amount === "vegan" || amount === "vegetarian")) return `Covered by eating ${amount}`;
  if (p.id === "dairy" && amount === "vegan") return "Covered by eating vegan";
  if (p.id === "car" && num(amount) === 0) return "Covered by not driving";
  if (p.id === "flights" && num(amount) === 0) return "Covered by not flying";
  return null;
}

const DIETS: { value: Diet; label: string }[] = [
  { value: "meat-heavy", label: "Meat at most meals" },
  { value: "average", label: "Some meat" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
];
const LEVELS: { value: Shopping; label: string }[] = [
  { value: "low", label: "Less than most" },
  { value: "average", label: "About average" },
  { value: "high", label: "More than most" },
];
const level = (label: string): Amount => ({ kind: "choice", label, default: "average", options: LEVELS });
const dollars = (def: number): Amount => ({ kind: "number", label: "Spent a month", unit: "a month", prefix: "$", default: def, step: 5 });

const aiChat = (a: number | string, span: Span, ctx: Context) =>
  lifetimeOffset(
    {
      ...base(ctx),
      aiPromptsPerDay: num(a),
      aiBuiltInPerDay: F.AI_BUILT_IN_PROMPTS_PER_DAY,
      aiWhPerPrompt: ctx.aiWhPerPrompt,
      aiFromExport: ctx.aiFromExport,
      aiPastWh: ctx.aiPastWh,
    },
    ["ai"],
    undefined,
    span,
  ).parts.ai.impacts;

/** Coding hours to count: none when a linked Claude or ChatGPT account already measured coding in with chat. */
/** Coding measured from a linked account: Claude's weekly limit (which covers Claude Code) or ChatGPT's agent and Codex tokens. */
export const codingMeasured = (ctx: Context) => Boolean(ctx.aiFromExport && (ctx.aiCode || ctx.aiAgent));
const codingHours = (a: number | string) => num(a);
const aiCoding = (a: number | string, span: Span, ctx: Context) =>
  lifetimeOffset({ ...base(ctx), aiCodingHoursPerWeek: num(a), aiCodingPastWh: ctx.aiCodingPastWh }, ["ai"], undefined, span).parts.ai.impacts;

export const PRODUCTS: Product[] = [
  {
    id: "ai",
    section: "ai",
    name: "AI chat",
    blurb: "ChatGPT, Claude, Gemini and the rest, plus the AI built into search and other apps, including training the models and building the data centers.",
    amount: { kind: "number", label: "AI prompts a day", unit: "prompts a day", default: 10, step: 1 },
    oneTime: true,
    cost: (a, span, ctx) => costOf(aiChat(a, span, ctx)),
    impacts: (a, span, ctx) => aiChat(a, span, ctx),
    kgPerYear: (a, ctx) =>
      aiImpacts((num(a) * 365 * (ctx.aiWhPerPrompt ?? F.WH_PER_AI_PROMPT) + F.AI_BUILT_IN_PROMPTS_PER_DAY * 365 * F.WH_PER_AI_PROMPT) / 1000).carbon,
  },
  {
    id: "ai-media",
    section: "ai",
    name: "AI images",
    blurb: "Pictures you make with AI.",
    // Default 1 a week. Google reported 50 billion Nano Banana images by May 2026, up from 5 billion in mid-October 2025:
    // about 1.5 a week for each of Gemini's 900 million monthly users, a mean pulled up by heavy users.
    amount: { kind: "number", label: "AI images a week", unit: "images a week", default: 1, step: 1 },
    oneTime: true,
    cost: (a, span, ctx) => costOf(lifetimeOffset({ ...base(ctx), aiMediaPerWeek: num(a) }, ["ai"], undefined, span).parts.ai.impacts),
    impacts: (a, span, ctx) => lifetimeOffset({ ...base(ctx), aiMediaPerWeek: num(a) }, ["ai"], undefined, span).parts.ai.impacts,
    kgPerYear: (a) => aiImpacts((num(a) * 52 * F.WH_PER_AI_MEDIA) / 1000).carbon,
  },
  {
    id: "ai-video",
    section: "ai",
    name: "AI video",
    blurb: "Short clips you make with Sora, Veo and the like. Each one takes far more power than a picture.",
    amount: { kind: "number", label: "AI videos a week", unit: "videos a week", default: 0, step: 1 },
    oneTime: true,
    cost: (a, span, ctx) => costOf(lifetimeOffset({ ...base(ctx), aiVideoPerWeek: num(a) }, ["ai"], undefined, span).parts.ai.impacts),
    impacts: (a, span, ctx) => lifetimeOffset({ ...base(ctx), aiVideoPerWeek: num(a) }, ["ai"], undefined, span).parts.ai.impacts,
    kgPerYear: (a) => aiImpacts((num(a) * 52 * F.WH_PER_AI_VIDEO) / 1000).carbon,
  },
  {
    id: "ai-coding",
    section: "ai",
    name: "Coding with AI",
    blurb: "Hours you spend with a coding agent like Claude Code, Codex or Cursor. An hour of it takes far more power than chatting. Linking Claude or ChatGPT fills this in.",
    amount: { kind: "number", label: "Hours a week with a coding agent", unit: "hours a week", default: 0, step: 5 },
    oneTime: true,
    cost: (a, span, ctx) => costOf(aiCoding(a, span, ctx)),
    impacts: (a, span, ctx) => aiCoding(a, span, ctx),
    kgPerYear: (a) => aiImpacts((codingHours(a) * 52 * F.WH_PER_CLAUDE_CODE_HOUR) / 1000).carbon,
  },
  onlineItem("video", "Video streaming", "YouTube, Netflix, Twitch.", 2),
  onlineItem("social", "Social media", "TikTok, Instagram, Facebook, X.", 1),
  onlineItem("gaming", "Cloud gaming", "Games streamed from a server.", 1),
  onlineItem("calls", "Video calls", "Zoom, FaceTime, Teams.", 0.5),
  onlineItem("music", "Music and podcasts", "Spotify, Apple Music, podcasts.", 1),
  onlineItem("browsing", "Browsing and email", "Web, email and cloud files.", 2),
  deviceItem("phone", "Phone", "Every phone you'll go through, and charging it.", 1),
  deviceItem("laptop", "Laptop", "Making and running your laptops.", 1),
  deviceItem("tablet", "Tablet", "Making and running your tablets.", 1),
  deviceItem("desktop", "Desktop computer", "Making and running a desktop and monitor.", 1),
  deviceItem("tv", "TV", "Making and running your TVs.", 1),
  deviceItem("console", "Game console", "Making and running your consoles.", 1),
  lifeItem(
    "electricity",
    "home",
    "Electricity",
    "Your home's power, on your state's grid.",
    { kind: "number", label: "Electricity a month", unit: "kWh a month", default: 0, step: 50 },
    (a, ctx) => ({ electricity: num(a) ? { mode: "kwh", amount: num(a) } : { mode: "average" }, state: ctx.state }),
    "electricity",
  ),
  lifeItem(
    "heating",
    "home",
    "Gas heating",
    "Natural gas for heat and hot water.",
    { kind: "number", label: "Gas bill a month", unit: "gas bill a month", prefix: "$", default: 60, step: 5 },
    (a) => ({ heating: { fuel: "gas", mode: "bill", billAmount: num(a) } }),
    "heating",
  ),
  lifeItem(
    "car",
    "travel",
    "Driving",
    "Fuel, tailpipe pollution and the water behind it.",
    { kind: "number", label: "Miles driven a week", unit: "miles a week", default: 200, step: 10 },
    (a) => ({ car: { type: "gas", milesPerWeek: num(a) } }),
    "car",
  ),
  lifeItem(
    "rideshare",
    "travel",
    "Uber and Lyft",
    "Your rides, plus the driving between fares.",
    { kind: "number", label: "Ride miles a week", unit: "ride miles a week", default: F.RIDESHARE_MILES_PER_WEEK, step: 5 },
    (a) => ({ car: { type: "gas", milesPerWeek: num(a) * F.RIDESHARE_EMPTY_MILES } }),
    "car",
  ),
  lifeItem(
    "flights",
    "travel",
    "Flights",
    "Round trips, including contrails' extra warming.",
    { kind: "number", label: "Round trips a year", unit: "round trips a year", default: 2, step: 1 },
    (a) => ({ flights: { shortPerYear: num(a), longPerYear: 0 } }),
    "flights",
  ),
  lifeItem(
    "transit",
    "travel",
    "Bus and train",
    "Public transit miles.",
    { kind: "number", label: "Transit miles a week", unit: "miles a week", default: 20, step: 5 },
    (a) => ({ transit: { milesPerWeek: num(a) } }),
    "transit",
  ),
  lifeItem(
    "meat",
    "food",
    "Meat and fish",
    "Carbon, water and land to raise it.",
    { kind: "choice", label: "Your diet", default: "average", options: DIETS },
    (a) => ({ diet: a as Diet }),
    "meat",
  ),
  lifeItem(
    "dairy",
    "food",
    "Dairy and eggs",
    "Carbon, water and land to produce them.",
    { kind: "choice", label: "Your diet", default: "average", options: DIETS },
    (a) => ({ diet: a as Diet }),
    "dairy",
  ),
  lifeItem(
    "plants",
    "food",
    "Plant foods",
    "Grains, fruit and vegetables.",
    { kind: "choice", label: "Your diet", default: "average", options: DIETS },
    (a) => ({ diet: a as Diet }),
    "plants",
  ),
  lifeItem(
    "delivery",
    "food",
    "Food delivery",
    "The courier's drive to your door.",
    { kind: "number", label: "Deliveries a week", unit: "deliveries a week", default: F.DELIVERIES_PER_WEEK, step: 0.5 },
    (a) => ({ car: { type: "gas", milesPerWeek: num(a) * F.MILES_PER_DELIVERY } }),
    "car",
  ),
  lifeItem("clothing", "shopping", "Clothing", "Making the clothes and shoes you buy.", dollars(F.GOODS_USD_PER_MONTH.clothing), (a) => ({ shoppingUsd: { clothing: num(a) } }), "clothing"),
  lifeItem("electronics", "shopping", "Electronics", "Gadgets beyond your main devices.", dollars(F.GOODS_USD_PER_MONTH.electronics), (a) => ({ shoppingUsd: { electronics: num(a) } }), "electronics"),
  lifeItem("household", "shopping", "Home goods", "Furniture, kitchen and things for the house.", dollars(F.GOODS_USD_PER_MONTH.household), (a) => ({ shoppingUsd: { household: num(a) } }), "household"),
  // Toys, books, beauty, pets and the rest: priced like home goods, the closest of the EPA's groups.
  lifeItem("othergoods", "shopping", "Everything else", "Books, toys, beauty, pet supplies and the rest.", dollars(F.GOODS_USD_PER_MONTH.other), (a) => ({ shoppingUsd: { household: num(a) } }), "household"),
  lifeItem("services", "shopping", "Services", "Eating out, subscriptions and other services.", level("How much you buy"), (a) => ({ shopping: a as Shopping }), "services"),
];

/** Tailpipe CO2 per mile for an average gas car, used to make yearly figures relatable. */
export const KG_PER_CAR_MILE = F.KG_CO2_PER_GAL_GASOLINE / F.DEFAULT_MPG;

/** A one-line "why it matters" for a tile, from the item's own yearly estimate. */
export function yearlyLine(p: Product, amount: number | string, ctx: Context): string {
  const kg = p.kgPerYear(amount, ctx);
  const amountKg = kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${kg < 10 ? kg.toFixed(1) : Math.round(kg).toLocaleString("en-US")} kg`;
  const head = `About ${amountKg} of CO₂e a year`;
  if (p.section === "travel" || kg < 0.3) return `${head}.`;
  const miles = kg / KG_PER_CAR_MILE;
  return `${head}, like driving ${miles < 10 ? miles.toFixed(1) : Math.round(miles).toLocaleString("en-US")} miles.`;
}

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);

/** Accounts that fill in each item's amount. Online time and devices have no account to read yet, so they stay typed in. */
const AI_SOURCES: ProviderId[] = ["chatgpt", "claude", "gemini", "openai-api", "anthropic-api"];
const SOURCES: Record<SectionKey, ProviderId[]> = {
  ai: AI_SOURCES,
  online: [],
  devices: [],
  home: ["utility"],
  travel: ["bank"],
  food: [],
  shopping: ["bank"],
};
export function sourcesFor(p: Product): ProviderId[] {
  if (p.id === "car") return ["activity", "car"];
  if (p.id === "transit") return ["activity"];
  if (p.id === "flights") return ["activity", "bank"];
  if (p.id === "video" || p.id === "music") return ["activity"];
  if (p.id === "electricity" || p.id === "heating") return ["activity", "utility"];
  return SOURCES[p.section];
}

export function defaultAmount(p: Product, ctx: Context): number | string {
  if (p.id === "electricity") return STATES[ctx.state].avgKwhPerMonth;
  return p.amount.default;
}

/**
 * How an item is covered. Past use is a checkbox that adds to either choice;
 * going forward is ongoing (billed yearly or monthly) or lifetime (one payment),
 * never both. Everyday items are ongoing only, with past use as an opt-in.
 */
export type Ahead = "monthly" | "lifetime";
export interface Cover {
  past: boolean;
  ahead: Ahead;
}

/** Ways to cover an item going forward. Light items are lifetime only; lifetime hides above the cap unless asked for. */
export function aheadFor(p: Product, amount: number | string, ctx: Context, showLifetimeAnyway = false): Ahead[] {
  if (!p.oneTime) return showLifetimeAnyway ? ["monthly", "lifetime"] : ["monthly"];
  // Every item can be paid monthly; one-time items can also be paid once for life, unless that's over the cap.
  const cost = p.cost(amount, "lifetime", ctx);
  const life = cost + paymentFee(cost);
  if (life > LIFETIME_MAX_USD && !showLifetimeAnyway) return ["monthly"];
  // Under a cent a month isn't worth a monthly payment: just pay once (Ian, 2026-10-13).
  return p.cost(amount, "monthly", ctx) < MONTHLY_MIN_USD ? ["lifetime"] : ["monthly", "lifetime"];
}

/** Below this a month, monthly isn't offered for items that can be paid once for life. */
export const MONTHLY_MIN_USD = 0.01;

/** Below this a month, an item leads with paying once for life: cents a month reads as trivial, but each payment's 30¢ card fee isn't. */
export const SMALL_MONTHLY_USD = 1;
/** The featured AI item leads with lifetime only up to this; heavier users see monthly first (Ian, 2026-10-11). */
export const AI_LIFETIME_FIRST_MAX_USD = 100;

/** Whether AI's lifetime price is small enough to lead with. */
export const aiLeadsLifetime = (amount: number | string, ctx: Context) =>
  coverPrice(PRODUCTS.find((x) => x.id === "ai")!, amount, { past: true, ahead: "lifetime" }, ctx).once <= AI_LIFETIME_FIRST_MAX_USD;

/** The cover an item actually uses: what was picked if still offered, else monthly (lifetime for the featured AI item and tiny items). Past use starts checked. */
export function effectiveCover(
  p: Product,
  amount: number | string,
  ctx: Context,
  picked: Partial<Cover> = {},
  showLifetimeAnyway = false,
): Cover {
  const options = aheadFor(p, amount, ctx, showLifetimeAnyway);
  const small = p.id === "ai" ? aiLeadsLifetime(amount, ctx) : p.cost(amount, "monthly", ctx) < SMALL_MONTHLY_USD;
  const fallback: Ahead = !options.includes("monthly") || (small && options.includes("lifetime")) ? "lifetime" : "monthly";
  const ahead = picked.ahead && options.includes(picked.ahead) ? picked.ahead : fallback;
  // Online items start with past use in; everyday items' past is opt-in, since years of driving or food add up fast.
  return { past: picked.past ?? p.oneTime, ahead };
}

/** Badge wording for a cover, e.g. "for life" or "to date + each month". */
export function coverBadge(c: Cover, billing: Billing): string {
  const ahead = c.ahead === "lifetime" ? (c.past ? "for life" : "all future use") : `each ${billing === "annual" ? "year" : "month"}`;
  return c.past && c.ahead === "monthly" ? `to date + ${ahead}` : ahead;
}

/** An item's price under a cover: what goes in the one-time payment and what's billed each month. */
export function coverPrice(p: Product, amount: number | string, cover: Cover, ctx: Context) {
  const once = (cover.past ? p.cost(amount, "past", ctx) : 0) + (cover.ahead === "lifetime" ? p.cost(amount, "future", ctx) : 0);
  const monthly = cover.ahead === "monthly" ? p.cost(amount, "monthly", ctx) : 0;
  return { once, monthly };
}

/** Everything an item covers under a cover: the one-time part and each month of the ongoing part. */
export function coverImpacts(p: Product, amount: number | string, cover: Cover, ctx: Context) {
  const zero: Impacts = { carbon: 0, air: 0, water: 0, land: 0, ewaste: 0 };
  const once = sumImpacts([
    cover.past ? p.impacts(amount, "past", ctx) : zero,
    cover.ahead === "lifetime" ? p.impacts(amount, "future", ctx) : zero,
  ]);
  const monthly = cover.ahead === "monthly" ? p.impacts(amount, "monthly", ctx) : zero;
  return { once, monthly };
}

export interface PlanLine {
  productId: string;
  amount: number | string;
  cover: Cover;
}

/**
 * Past use can be paid all at once (0) or spread over this many years, always
 * offered (Ian, 2026-10-12). Each instalment is the past total divided by the
 * months, with nothing added or taken off.
 */
export const PAST_YEARS = [0, 1, 2, 3, 5, 10] as const;
export type PastYears = (typeof PAST_YEARS)[number];

/** The most a past-use instalment should add to a month by default. */
export const PAST_MONTHLY_CAP_USD = 10;

/** The shortest spread that keeps past use at or under the cap a month, or the longest one offered. */
export function defaultPastYears(pastTotal: number): PastYears {
  if (pastTotal <= PAST_MONTHLY_CAP_USD) return 0;
  return PAST_YEARS.find((y) => y > 0 && pastTotal / (y * 12) <= PAST_MONTHLY_CAP_USD) ?? PAST_YEARS[PAST_YEARS.length - 1];
}

export interface PlanTotals {
  lines: (PlanLine & { product: Product; pastCost: number; aheadCost: number })[];
  oneTime: { donation: number; fee: number; total: number } | null;
  /** Ongoing items, plus any past-use instalment, charged each billing period. */
  recurring: Recurring | null;
  /** Past use paid in instalments, when spread over years. */
  pastSpread: { total: number; years: Exclude<PastYears, 0>; perMonth: number } | null;
}

/**
 * Adds up a plan: past use and lifetime items share one payment and minimum;
 * ongoing items share one payment each month or year. Past use spread over
 * years moves into the ongoing payment instead. Each payment carries only its
 * own card fee.
 */
export function planTotals(plan: PlanLine[], ctx: Context, billing: Billing = DEFAULT_BILLING, pastYears: PastYears = 0): PlanTotals {
  const lines = plan.flatMap((l) => {
    const product = productById(l.productId);
    if (!product) return [];
    const pastCost = l.cover.past ? product.cost(l.amount, "past", ctx) : 0;
    const aheadCost = product.cost(l.amount, l.cover.ahead === "lifetime" ? "future" : "monthly", ctx);
    return [{ ...l, product, pastCost, aheadCost }];
  });
  // Only items paid monthly spread their past use; a lifetime item's past goes in with it, all at once.
  const spreadable = (l: (typeof lines)[number]) => l.cover.ahead === "monthly";
  const pastSum = lines.reduce((s, l) => s + (spreadable(l) ? l.pastCost : 0), 0);
  const pastSpread = pastYears > 0 && pastSum > 0 ? { total: pastSum, years: pastYears as Exclude<PastYears, 0>, perMonth: pastSum / (pastYears * 12) } : null;
  const onceSum = lines.reduce((s, l) => s + (pastSpread && spreadable(l) ? 0 : l.pastCost) + (l.cover.ahead === "lifetime" ? l.aheadCost : 0), 0);
  const ongoing = lines.filter((l) => l.cover.ahead === "monthly");
  const hasOnce = lines.some((l) => (l.cover.past && !(pastSpread && spreadable(l))) || l.cover.ahead === "lifetime");
  const oneTime = hasOnce
    ? (() => {
        const donation = Math.max(LIFETIME_MIN_DONATION_USD, Math.ceil(onceSum));
        const fee = paymentFee(donation);
        return { donation, fee, total: Math.round((donation + fee) * 100) / 100 };
      })()
    : null;
  const recurring =
    ongoing.length || pastSpread
      ? recurringPrice(ongoing.reduce((s, l) => s + l.aheadCost, 0) + (pastSpread?.perMonth ?? 0), billing)
      : null;
  return { lines, oneTime, recurring, pastSpread };
}

export type HarmSplit = Record<"carbon" | "air" | "water" | "land" | "ewaste", { once: number; perPeriod: number }>;

/**
 * How a plan's donation divides between the five harms, for people who'd rather
 * give to each charity themselves. Each line's cost is split in proportion to
 * what it costs per harm; ongoing amounts are per billing period. Before minimums and fees.
 */
export function harmSplit(totals: PlanTotals, ctx: Context, billing: Billing = DEFAULT_BILLING): HarmSplit {
  const out: HarmSplit = {
    carbon: { once: 0, perPeriod: 0 },
    air: { once: 0, perPeriod: 0 },
    water: { once: 0, perPeriod: 0 },
    land: { once: 0, perPeriod: 0 },
    ewaste: { once: 0, perPeriod: 0 },
  };
  const add = (cost: number, impacts: Impacts, field: "once" | "perPeriod") => {
    const c = impactCost(impacts);
    const sum = c.carbon + c.air + c.water + c.land + c.ewaste;
    if (!(cost > 0) || !(sum > 0)) return;
    for (const k of Object.keys(out) as (keyof HarmSplit)[]) out[k][field] += (cost * c[k]) / sum;
  };
  for (const l of totals.lines) {
    const months = totals.pastSpread ? totals.pastSpread.years * 12 : 0;
    if (l.pastCost && months && l.cover.ahead === "monthly") add((l.pastCost / months) * (billing === "annual" ? 12 : 1), l.product.impacts(l.amount, "past", ctx), "perPeriod");
    else if (l.pastCost) add(l.pastCost, l.product.impacts(l.amount, "past", ctx), "once");
    const lifetime = l.cover.ahead === "lifetime";
    const ahead = l.product.impacts(l.amount, lifetime ? "future" : "monthly", ctx);
    add(lifetime ? l.aheadCost : l.aheadCost * (billing === "annual" ? 12 : 1), ahead, lifetime ? "once" : "perPeriod");
  }
  return out;
}
