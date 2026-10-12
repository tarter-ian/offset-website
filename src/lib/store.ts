import * as F from "./factors";
import { STATES, type StateCode } from "./data/states";
import { aiImpacts, computeFootprint, dataCenterImpacts, DEFAULT_ANSWERS, gridImpacts, sumImpacts, type Impacts, type Answers, type CategoryKey, type Diet, type Shopping } from "./footprint";
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
import type { CodeEstimate } from "./ai/exportParser";
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
  /** The year the person says they started using AI. */
  aiStartYear?: number;
  /** A quick AI estimate: a picked level, or the plan from a sign-in. */
  aiEstimate?: { level?: AiLevel; from: string };
}

export const DEFAULT_CONTEXT: Context = { birthYear: DEFAULT_LIFETIME_INPUT.birthYear, state: DEFAULT_ANSWERS.state };

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
  internetHoursPerDay: NO_ONLINE,
  aiPromptsPerDay: 0,
  aiMediaPerWeek: 0,
  devices: NO_DEVICES,
});
const num = (v: number | string) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

const costOf = (i: Impacts) => {
  const c = impactCost(i);
  return c.carbon + c.air + c.water + c.land;
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

function lifeItem(
  id: string,
  section: SectionKey,
  name: string,
  blurb: string,
  amount: Amount,
  answers: (a: number | string, ctx: Context) => Partial<Answers>,
  keys: CategoryKey | CategoryKey[],
): Product {
  return {
    id,
    section,
    name,
    blurb,
    amount,
    oneTime: false,
    cost: (a, _span, ctx) => costOf(monthly(keys, { ...DEFAULT_ANSWERS, state: ctx.state, ...answers(a, ctx) })),
    impacts: (a, _span, ctx) => monthly(keys, { ...DEFAULT_ANSWERS, state: ctx.state, ...answers(a, ctx) }),
    kgPerYear: (a, ctx) => {
      const ks = Array.isArray(keys) ? keys : [keys];
      const f = computeFootprint({ ...DEFAULT_ANSWERS, state: ctx.state, ...answers(a, ctx) });
      return 12 * f.categories.filter((c) => ks.includes(c.key)).reduce((sum, c) => sum + c.impacts.carbon, 0);
    },
  };
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
    amount: { kind: "number", label: "AI images a week", unit: "images a week", default: 5, step: 1 },
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
    amount: { kind: "number", label: "AI videos a week", unit: "videos a week", default: 1, step: 1 },
    oneTime: true,
    cost: (a, span, ctx) => costOf(lifetimeOffset({ ...base(ctx), aiVideoPerWeek: num(a) }, ["ai"], undefined, span).parts.ai.impacts),
    impacts: (a, span, ctx) => lifetimeOffset({ ...base(ctx), aiVideoPerWeek: num(a) }, ["ai"], undefined, span).parts.ai.impacts,
    kgPerYear: (a) => aiImpacts((num(a) * 52 * F.WH_PER_AI_VIDEO) / 1000).carbon,
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
  lifeItem("clothing", "shopping", "Clothing", "Making the clothes you buy.", level("How much you buy"), (a) => ({ shopping: a as Shopping }), "clothing"),
  lifeItem("electronics", "shopping", "Electronics", "Gadgets beyond your main devices.", level("How much you buy"), (a) => ({ shopping: a as Shopping }), "electronics"),
  lifeItem("household", "shopping", "Home goods", "Furniture and things for the house.", level("How much you buy"), (a) => ({ shopping: a as Shopping }), "household"),
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
  return SOURCES[p.section];
}

/** What AI chat adds up to under a cover, for the itemized receipt on the home page. */
export function aiBreakdown(promptsPerDay: number, ctx: Context, cover: { past: boolean; ahead: "monthly" | "lifetime" }) {
  const spans: Span[] = [...(cover.past ? (["past"] as const) : []), cover.ahead === "lifetime" ? "future" : "monthly"];
  const input = { ...base(ctx), aiPromptsPerDay: num(promptsPerDay), aiWhPerPrompt: ctx.aiWhPerPrompt, aiFromExport: ctx.aiFromExport, aiPastWh: ctx.aiPastWh };
  const parts = spans.map((s) => lifetimeOffset(input, ["ai"], undefined, s).parts.ai.impacts);
  const impacts = { carbon: 0, air: 0, water: 0, land: 0 };
  for (const i of parts) for (const k of Object.keys(impacts) as (keyof typeof impacts)[]) impacts[k] += i[k];
  return { impacts };
}

export function defaultAmount(p: Product, ctx: Context): number | string {
  if (p.id === "electricity") return STATES[ctx.state].avgKwhPerMonth;
  return p.amount.default;
}

/**
 * How an item is covered. Past use is a checkbox that adds to either choice;
 * going forward is ongoing (billed yearly or monthly) or lifetime (one payment),
 * never both. Everyday items are ongoing only, with no past option.
 */
export type Ahead = "monthly" | "lifetime";
export interface Cover {
  past: boolean;
  ahead: Ahead;
}

/** Ways to cover an item going forward. Light items are lifetime only; lifetime hides above the cap unless asked for. */
export function aheadFor(p: Product, amount: number | string, ctx: Context, showLifetimeAnyway = false): Ahead[] {
  if (!p.oneTime) return ["monthly"];
  // Every item can be paid monthly; one-time items can also be paid once for life, unless that's over the cap.
  const cost = p.cost(amount, "lifetime", ctx);
  const life = cost + paymentFee(cost);
  return life > LIFETIME_MAX_USD && !showLifetimeAnyway ? ["monthly"] : ["monthly", "lifetime"];
}

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
  const fallback: Ahead = small && options.includes("lifetime") ? "lifetime" : "monthly";
  const ahead = picked.ahead && options.includes(picked.ahead) ? picked.ahead : fallback;
  return { past: p.oneTime && (picked.past ?? true), ahead };
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
  const zero: Impacts = { carbon: 0, air: 0, water: 0, land: 0 };
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

export interface PlanTotals {
  lines: (PlanLine & { product: Product; pastCost: number; aheadCost: number })[];
  oneTime: { donation: number; fee: number; total: number } | null;
  /** Ongoing items, charged each billing period. */
  recurring: Recurring | null;
}

/**
 * Adds up a plan: past use and lifetime items share one payment and minimum;
 * ongoing items share one payment each month or year. Each payment carries
 * only its own card fee.
 */
export function planTotals(plan: PlanLine[], ctx: Context, billing: Billing = DEFAULT_BILLING): PlanTotals {
  const lines = plan.flatMap((l) => {
    const product = productById(l.productId);
    if (!product) return [];
    const pastCost = l.cover.past ? product.cost(l.amount, "past", ctx) : 0;
    const aheadCost = product.cost(l.amount, l.cover.ahead === "lifetime" ? "future" : "monthly", ctx);
    return [{ ...l, product, pastCost, aheadCost }];
  });
  const onceSum = lines.reduce((s, l) => s + l.pastCost + (l.cover.ahead === "lifetime" ? l.aheadCost : 0), 0);
  const ongoing = lines.filter((l) => l.cover.ahead === "monthly");
  const hasOnce = lines.some((l) => l.cover.past || l.cover.ahead === "lifetime");
  const oneTime = hasOnce
    ? (() => {
        const donation = Math.max(LIFETIME_MIN_DONATION_USD, Math.ceil(onceSum));
        const fee = paymentFee(donation);
        return { donation, fee, total: Math.round((donation + fee) * 100) / 100 };
      })()
    : null;
  const recurring = ongoing.length
    ? recurringPrice(
        ongoing.reduce((s, l) => s + l.aheadCost, 0),
        billing,
      )
    : null;
  return { lines, oneTime, recurring };
}
