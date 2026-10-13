import { payRows, PLAN_ID, type PayRow } from "./payments";
import { DEFAULT_CONTEXT, defaultAmount, harmSplit, type HarmSplit, planTotals, PRODUCTS, productById, SECTIONS, type Context, type Product } from "./store";

// Gifting an offset: one person pays the charities for someone else's typical
// use of one or more items, for some years or for life (Ian, 2026-10-12), such
// as a parent covering a graduate's online life for good. The giver gets a link
// to send; the person who opens it can mark the items as covered.

export type GiftSpan = "month" | "year" | "5years" | "10years" | "life";
export const GIFT_SPANS: GiftSpan[] = ["month", "year", "5years", "10years", "life"];
const SPAN_MONTHS: Record<Exclude<GiftSpan, "life">, number> = { month: 1, year: 12, "5years": 60, "10years": 120 };
export const SPAN_LABEL: Record<GiftSpan, string> = {
  month: "for a month",
  year: "for a year",
  "5years": "for 5 years",
  "10years": "for 10 years",
  life: "for life",
};
/** Months a span covers, or null for life. */
export const spanMonths = (span: GiftSpan): number | null => (span === "life" ? null : SPAN_MONTHS[span]);

export interface GiftItem {
  productId: string;
  span: GiftSpan;
}

export interface Gift {
  id: string;
  items: GiftItem[];
  /** The recipient's birth year, which sets how long "for life" runs. */
  birthYear: number;
  from: string;
  /** Who it's for: one name, or several on their own lines when one payment covers each of them. */
  to: string;
  note: string;
  createdAt: string;
}

export const GIFT_LIMITS = { from: 40, to: 40, note: 200, items: PRODUCTS.length, people: 20 } as const;

/** Everyone a gift is for. Each gets their own card link, /gift/<id>?for=<n>. */
export const recipients = (gift: Pick<Gift, "to">): string[] => gift.to.split("\n").filter(Boolean);

/** Where one person's card for a gift lives: no suffix for a gift to one person. */
export const giftPath = (id: string, n: number, count: number) => (count > 1 ? `/gift/${id}?for=${n}` : `/gift/${id}`);

/** The context a gift is priced in: typical US use, with the recipient's age when given. */
export const giftContext = (birthYear: number): Context => ({ ...DEFAULT_CONTEXT, birthYear });

/** Items worth gifting: anything with something to cover at typical use. Every item can be gifted for life, with no price cap. */
export const giftable = (p: Product) => p.cost(defaultAmount(p, DEFAULT_CONTEXT), "monthly", DEFAULT_CONTEXT) > 0;
export const GIFTABLE = PRODUCTS.filter(giftable);

/** The span a gift starts each item on: for life for AI, online and devices, a year for everyday items. */
export const defaultGiftSpan = (p: Product): GiftSpan => (p.oneTime ? "life" : "year");

const empty = (): HarmSplit => ({
  carbon: { once: 0, perPeriod: 0 },
  air: { once: 0, perPeriod: 0 },
  water: { once: 0, perPeriod: 0 },
  land: { once: 0, perPeriod: 0 },
  ewaste: { once: 0, perPeriod: 0 },
});

/**
 * The one-time gifts to each charity that pay for a gift, at typical use.
 * Worked out the same way on the server, so a gift link can't claim more than was paid.
 */
export function giftRows(items: GiftItem[], birthYear: number = DEFAULT_CONTEXT.birthYear, people = 1): PayRow[] {
  const ctx = giftContext(birthYear);
  const total = empty();
  for (const item of items) {
    const p = productById(item.productId);
    if (!p || !giftable(p)) return [];
    const amount = defaultAmount(p, ctx);
    const span = item.span;
    const split = harmSplit(planTotals([{ productId: p.id, amount, cover: { past: false, ahead: span === "life" ? "lifetime" : "monthly" } }], ctx, "monthly"), ctx, "monthly");
    const months = spanMonths(span) ?? 0;
    for (const k of Object.keys(total) as (keyof HarmSplit)[]) total[k].once += (split[k].once + split[k].perPeriod * months) * people;
  }
  // Gifts are given through Every.org in every payment mode, so each gift page can see its own confirmations.
  return payRows(total, "monthly", false, "every");
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Checks what the giver sent. Names and at least one item are required; the note is optional. */
export function parseGift(body: unknown, now = new Date()): { ok: true; gift: Gift } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Body isn't a JSON object." };
  const b = body as Record<string, unknown>;
  if (typeof b.id !== "string" || !PLAN_ID.test(b.id)) return { ok: false, error: "Bad gift id." };
  if (!Array.isArray(b.items) || !b.items.length || b.items.length > GIFT_LIMITS.items) return { ok: false, error: "Pick at least one item." };
  const items: GiftItem[] = [];
  for (const i of b.items as unknown[]) {
    const it = i as Record<string, unknown> | null;
    const p = typeof it?.productId === "string" ? productById(it.productId) : undefined;
    if (!p || !giftable(p)) return { ok: false, error: "Unknown item." };
    if (!GIFT_SPANS.includes(it!.span as GiftSpan)) return { ok: false, error: "Unknown span." };
    if (items.some((x) => x.productId === p.id)) return { ok: false, error: "An item is listed twice." };
    items.push({ productId: p.id, span: it!.span as GiftSpan });
  }
  const year = now.getFullYear();
  const birthYear = typeof b.birthYear === "number" && Number.isInteger(b.birthYear) && b.birthYear >= year - 100 && b.birthYear <= year ? b.birthYear : DEFAULT_CONTEXT.birthYear;
  const from = clean(b.from, GIFT_LIMITS.from);
  const names = (Array.isArray(b.to) ? (b.to as unknown[]) : [b.to]).map((n) => clean(n, GIFT_LIMITS.to)).filter(Boolean);
  if (names.length > GIFT_LIMITS.people) return { ok: false, error: `A gift can be for up to ${GIFT_LIMITS.people} people.` };
  const to = names.join("\n");
  if (!from || !to) return { ok: false, error: "Add both names." };
  return { ok: true, gift: { id: b.id, items, birthYear, from, to, note: clean(b.note, GIFT_LIMITS.note), createdAt: now.toISOString() } };
}

/**
 * Whether every charity's gift has arrived, from the donations Every.org reported
 * for this gift. Each must be at least the donation asked for, so a smaller gift
 * under the same id doesn't count.
 */
export function giftPaid(id: string, rows: PayRow[], donations: { partnerDonationId: string | null; amount: number }[]): boolean {
  if (!rows.length) return false;
  return rows.every((r) => {
    const got = donations.filter((d) => d.partnerDonationId === `${id}.${r.key}`).reduce((s, d) => s + d.amount, 0);
    return got >= r.donation - 0.005;
  });
}

/** "driving", but "AI chat" keeps its capitals. */
export const lowerName = (name: string) => (/^[A-Z]{2}/.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1));

const list = (names: string[]) => (names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

/** "your AI chat and TV for life, and your driving for 5 years", for the gift card. Long lists are shortened. */
export function giftSentence(items: GiftItem[]): string {
  // Everything there is to cover reads as the whole footprint, whatever the span (Ian, 2026-10-12).
  const spans = GIFTABLE.map((p) => items.find((i) => i.productId === p.id)?.span);
  if (spans.every(Boolean)) {
    const shortest = GIFT_SPANS.find((sp) => spans.includes(sp))!;
    const label = spans.every((sp) => sp === shortest) ? SPAN_LABEL[shortest] : `${SPAN_LABEL[shortest]} or longer`;
    return `your whole footprint ${label}: climate, air, water, nature and e-waste, from AI to food to flights`;
  }
  const groups = GIFT_SPANS.slice()
    .reverse()
    .map((span) => ({ span, ids: items.filter((i) => i.span === span).map((i) => i.productId) }))
    .filter((g) => g.ids.length);
  return groups.map((g) => `${giftNames(g.ids, g.span)} ${SPAN_LABEL[g.span]}`).join(", and ");
}

const SECTION_PHRASE: Record<string, string> = {
  ai: "all your AI use",
  online: "everything you do online",
  devices: "all your devices",
  home: "your home's power and heat",
  travel: "all your travel",
  food: "all your food",
  shopping: "all your shopping",
};

/** Whole aisles first ("all your travel"), then single items, biggest gift first; past four, the smallest are counted, not named (Ian, 2026-10-13). */
function giftNames(ids: string[], span: GiftSpan): string {
  const sections = SECTIONS.filter((sec) => {
    const all = GIFTABLE.filter((p) => p.section === sec.key);
    return all.length > 1 && all.every((p) => ids.includes(p.id));
  });
  const whole = new Set(sections.map((sec) => sec.key));
  const price = (p: Product) => {
    const amount = defaultAmount(p, DEFAULT_CONTEXT);
    return span === "life" ? p.cost(amount, "future", DEFAULT_CONTEXT) : p.cost(amount, "monthly", DEFAULT_CONTEXT) * (spanMonths(span) ?? 0);
  };
  const singles = ids
    .map((id) => productById(id))
    .filter((p): p is Product => !!p && !whole.has(p.section))
    .sort((a, b) => price(b) - price(a))
    .map((p) => lowerName(p.name));
  const named = [
    ...sections.map((sec) => ({ section: true, text: SECTION_PHRASE[sec.key] ?? `all your ${sec.title.toLowerCase()}`, n: GIFTABLE.filter((p) => p.section === sec.key).length })),
    ...singles.map((text) => ({ section: false, text, n: 1 })),
  ];
  const shown = named.length > 4 ? named.slice(0, 3) : named;
  const rest = named.slice(shown.length).reduce((t, x) => t + x.n, 0);
  return phrase(
    shown.filter((x) => x.section).map((x) => x.text),
    shown.filter((x) => !x.section).map((x) => x.text),
    rest ? `${rest} more thing${rest === 1 ? "" : "s"}` : undefined,
  );
}

/** "all your travel, your TV and phone and 2 more things" */
function phrase(sectionPhrases: string[], singles: string[], more?: string): string {
  const items = more ? [...singles, more] : singles;
  const parts = [...sectionPhrases, ...(items.length ? [`your ${list(items)}`] : [])];
  return parts.length < 2 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/** When a gifted item's cover ends: never for life, else the gift's date plus its years. */
export function giftUntil(item: GiftItem, createdAt: string): string | null {
  if (item.span === "life") return null;
  const until = new Date(createdAt);
  until.setMonth(until.getMonth() + SPAN_MONTHS[item.span]);
  return until.toISOString();
}
