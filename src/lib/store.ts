import { STATES, type StateCode } from "./data/states";
import { computeFootprint, DEFAULT_ANSWERS, type Answers, type CategoryKey, type Diet, type Shopping } from "./footprint";
import {
  DEFAULT_LIFETIME_INPUT,
  LIFETIME_MAX_USD,
  lifetimeOffset,
  SPAN_CHOICE_ABOVE_USD,
  type Device,
  type InternetActivity,
  type LifetimeInput,
  type Span,
} from "./lifetime";
import {
  type Billing,
  DEFAULT_BILLING,
  FEE_PER_AREA_USD,
  impactCost,
  LIFETIME_FEE_USD,
  LIFETIME_MIN_DONATION_USD,
  MAX_FEE_USD,
  type Recurring,
  recurringPrice,
} from "./pricing";

// The storefront: each part of someone's life is an item they can offset on its
// own, priced from their amount. Online items can be covered for life, to date or
// ongoing; everyday items are ongoing, billed yearly or monthly. Minimums and fees
// apply to the whole plan.

export type SectionKey = "ai" | "online" | "devices" | "home" | "travel" | "food" | "shopping";

export const SECTIONS: { key: SectionKey; title: string; blurb: string }[] = [
  { key: "ai", title: "AI", blurb: "The cost of every prompt, image and the models behind them." },
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
  /** Measured from a linked AI account. */
  aiWhPerPrompt?: number;
  aiFromExport?: boolean;
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
}

const NO_ONLINE: Record<InternetActivity, number> = { video: 0, social: 0, gaming: 0, calls: 0, music: 0, browsing: 0 };
const NO_DEVICES: Record<Device, number> = { phone: 0, laptop: 0, tablet: 0, desktop: 0, tv: 0, console: 0 };
const base = (ctx: Context): LifetimeInput => ({
  ...DEFAULT_LIFETIME_INPUT,
  birthYear: ctx.birthYear,
  internetHoursPerDay: NO_ONLINE,
  aiPromptsPerDay: 0,
  aiMediaPerWeek: 0,
  devices: NO_DEVICES,
});
const num = (v: number | string) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0);

function onlineItem(id: InternetActivity, name: string, blurb: string, hours: number): Product {
  return {
    id,
    section: "online",
    name,
    blurb,
    amount: { kind: "number", label: `${name} hours a day`, unit: "hours a day", default: hours, step: 0.25 },
    oneTime: true,
    cost: (a, span, ctx) =>
      lifetimeOffset({ ...base(ctx), internetHoursPerDay: { ...NO_ONLINE, [id]: num(a) } }, ["internet"], undefined, span).parts.internet
        .cost,
  };
}

function deviceItem(id: Device, name: string, blurb: string, count: number): Product {
  return {
    id,
    section: "devices",
    name,
    blurb,
    amount: { kind: "number", label: `${name} you use`, unit: "at a time", default: count, step: 1 },
    oneTime: true,
    cost: (a, span, ctx) =>
      lifetimeOffset({ ...base(ctx), devices: { ...NO_DEVICES, [id]: Math.round(num(a)) } }, ["devices"], undefined, span).parts.devices
        .cost,
  };
}

/** Monthly donation for one category of the monthly footprint. */
function monthly(key: CategoryKey | CategoryKey[], answers: Answers): number {
  const keys = Array.isArray(key) ? key : [key];
  return computeFootprint(answers)
    .categories.filter((c) => keys.includes(c.key))
    .reduce((s, c) => {
      const x = impactCost(c.offset);
      return s + x.carbon + x.air + x.water + x.land;
    }, 0);
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
    cost: (a, _span, ctx) => monthly(keys, { ...DEFAULT_ANSWERS, state: ctx.state, ...answers(a, ctx) }),
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

export const PRODUCTS: Product[] = [
  {
    id: "ai",
    section: "ai",
    name: "AI chat",
    blurb: "ChatGPT, Claude, Gemini and the rest, including training the models and building the data centers.",
    amount: { kind: "number", label: "AI prompts a day", unit: "prompts a day", default: 10, step: 1 },
    oneTime: true,
    cost: (a, span, ctx) =>
      lifetimeOffset(
        { ...base(ctx), aiPromptsPerDay: num(a), aiWhPerPrompt: ctx.aiWhPerPrompt, aiFromExport: ctx.aiFromExport },
        ["ai"],
        undefined,
        span,
      ).parts.ai.cost,
  },
  {
    id: "ai-media",
    section: "ai",
    name: "AI images and video",
    blurb: "Pictures and clips you make with AI.",
    amount: { kind: "number", label: "AI images or videos a week", unit: "a week", default: 5, step: 1 },
    oneTime: true,
    cost: (a, span, ctx) => lifetimeOffset({ ...base(ctx), aiMediaPerWeek: num(a) }, ["ai"], undefined, span).parts.ai.cost,
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

export const productById = (id: string) => PRODUCTS.find((p) => p.id === id);

export function defaultAmount(p: Product, ctx: Context): number | string {
  if (p.id === "electricity") return STATES[ctx.state].avgKwhPerMonth;
  return p.amount.default;
}

/** Spans an item offers. Light online items are lifetime only; lifetime hides above the cap unless asked for. */
export function spansFor(p: Product, amount: number | string, ctx: Context, showLifetimeAnyway = false): Span[] {
  if (!p.oneTime) return ["monthly"];
  const life = p.cost(amount, "lifetime", ctx);
  if (life + LIFETIME_FEE_USD <= SPAN_CHOICE_ABOVE_USD) return ["lifetime"];
  return life + LIFETIME_FEE_USD > LIFETIME_MAX_USD && !showLifetimeAnyway ? ["past", "monthly"] : ["past", "monthly", "lifetime"];
}
/** The span an item actually uses: the one picked if it's still offered, else monthly or lifetime. */
export function effectiveSpan(p: Product, amount: number | string, ctx: Context, picked?: Span, showLifetimeAnyway = false): Span {
  const spans = spansFor(p, amount, ctx, showLifetimeAnyway);
  if (picked && spans.includes(picked)) return picked;
  return spans.includes("lifetime") ? "lifetime" : "monthly";
}

export interface PlanLine {
  productId: string;
  amount: number | string;
  span: Span;
}

export interface PlanTotals {
  lines: (PlanLine & { product: Product; cost: number })[];
  oneTime: { donation: number; fee: number; total: number } | null;
  /** Ongoing items, charged each billing period. */
  recurring: Recurring | null;
}

/** Adds up a plan: one-time items share one minimum and fee; ongoing items pay $1 a month each, up to the cap, billed yearly or monthly. */
export function planTotals(plan: PlanLine[], ctx: Context, billing: Billing = DEFAULT_BILLING): PlanTotals {
  const lines = plan.flatMap((l) => {
    const product = productById(l.productId);
    return product ? [{ ...l, product, cost: product.cost(l.amount, l.span, ctx) }] : [];
  });
  const once = lines.filter((l) => l.span !== "monthly");
  const ongoing = lines.filter((l) => l.span === "monthly");
  const sum = (ls: typeof lines) => ls.reduce((s, l) => s + l.cost, 0);
  const oneTime = once.length
    ? (() => {
        const donation = Math.max(LIFETIME_MIN_DONATION_USD, Math.ceil(sum(once)));
        return { donation, fee: LIFETIME_FEE_USD, total: donation + LIFETIME_FEE_USD };
      })()
    : null;
  const recurring = ongoing.length
    ? recurringPrice(sum(ongoing), Math.min(MAX_FEE_USD, FEE_PER_AREA_USD * ongoing.length), billing)
    : null;
  return { lines, oneTime, recurring };
}
