import type { Covered } from "./covered";
import { type ListItem, PAST } from "./publicList";
import { inForce, untilOf } from "./record";
import { type Context, defaultAmount, type Product, PRODUCTS, SECTIONS, type SectionKey } from "./store";

export { PAST };

// Badges (Ian, 2026-10-13): one system everywhere a badge shows. Fully Offset
// for everything in the store, "<aisle> offset" for a whole aisle, and one per
// item otherwise. Each is for life, through a date, or for past use once a
// date has passed. Never "carbon neutral".

export type BadgeKind = "full" | "aisle" | "item";

export interface BadgeInfo {
  kind: BadgeKind;
  /** "full", a section key, or a product id. */
  key: string;
  /** What the seal names, e.g. "AI" or "Video streaming"; "Fully" for the full badge. */
  name: string;
  /** ISO date the cover ends, null for life, or PAST once only past use is offset. A badge made of several items lasts as long as the shortest. */
  until: string | null;
}

/**
 * A badge's color says its term (Ian, 2026-10-13): green for life, blue while a
 * month or year runs, yellow once only past use is offset.
 */
export type Tone = "life" | "period" | "past";
export const toneOf = (until: string | null): Tone => (until === null ? "life" : until === PAST ? "past" : "period");

export const FULL_NAME = "Fully Offset";

const itemsIn = (section: SectionKey) => PRODUCTS.filter((p) => p.section === section);

/** The shortest cover among several: past use if any has only that, else the earliest date; null (for life) only when every one is for life. */
function shortest(untils: (string | null)[]): string | null {
  if (untils.includes(PAST)) return PAST;
  const dated = untils.filter((u): u is string => u !== null).sort();
  return dated[0] ?? null;
}

/**
 * The badges a set of offset items earns, biggest first: Fully Offset when every item
 * in the store is offset, then each whole aisle, then items outside a whole aisle.
 * `needed` narrows "every item" to the ones there is something to offset for this
 * person (see `toOffset`); by default it's the whole store.
 */
export function badgesFor(items: ListItem[], needed?: string[]): BadgeInfo[] {
  const until = new Map(items.map((i) => [i.productId, i.until]));
  const has = (id: string) => until.has(id);
  const need = needed ? new Set(needed) : null;
  const wanted = (ps: Product[]) => (need ? ps.filter((p) => need.has(p.id)) : ps);
  const whole = (ps: Product[]) => wanted(ps).length > 0 && wanted(ps).every((p) => has(p.id));
  const term = (ps: Product[]) => shortest(ps.filter((p) => has(p.id)).map((p) => until.get(p.id)!));
  if (whole(PRODUCTS)) return [{ kind: "full", key: "full", name: FULL_NAME, until: term(wanted(PRODUCTS)) }];
  const out: BadgeInfo[] = [];
  const loose: BadgeInfo[] = [];
  for (const s of SECTIONS) {
    const inAisle = itemsIn(s.key);
    if (whole(inAisle)) out.push({ kind: "aisle", key: s.key, name: s.title, until: term(wanted(inAisle)) });
    else for (const p of inAisle) if (has(p.id)) loose.push({ kind: "item", key: p.id, name: p.name, until: until.get(p.id)! });
  }
  return [...out, ...loose];
}

/**
 * The items there is something to offset at a person's own amounts: what Fully Offset
 * asks of them. An item at nothing, like AI video for someone who makes none, can't be
 * added to a plan, so it never stands between them and the badge.
 */
export function toOffset(amounts: Record<string, number | string>, ctx: Context): string[] {
  return PRODUCTS.filter((p) => {
    const a = amounts[p.id];
    const amount = a !== undefined && (p.amount.kind === "number") === (typeof a === "number") ? a : defaultAmount(p, ctx);
    return p.cost(amount, "monthly", ctx) > 0;
  }).map((p) => p.id);
}

/** What's offset now, as badges read it: in force (autopay rolled on to its next renewal), or past use paid for on a cover that has ended. */
export function offsetItems(covered: Record<string, Covered>, now: number): ListItem[] {
  return Object.entries(covered)
    .filter(([, c]) => inForce(c, now) || c.past)
    .map(([productId, c]) => ({ productId, until: c.kind === "life" ? null : inForce(c, now) ? untilOf(c, now) : PAST }));
}

/** The Fully Offset badge, when everything there is to offset is; null otherwise. */
export const fullBadge = (covered: Record<string, Covered>, needed: string[], now: number): BadgeInfo | null =>
  badgesFor(offsetItems(covered, now), needed).find((b) => b.kind === "full") ?? null;

/** A filter on the public list: everyone, Fully Offset, an aisle, or one item. */
export type ListFilter = { kind: "everyone" } | { kind: "full" } | { kind: "aisle"; key: SectionKey } | { kind: "item"; key: string };

/** Reads `?aisle=` (a section key or "everything") and `?item=` from the list page's address. Anything unknown means everyone. */
export function parseFilter(q: { aisle?: string; item?: string }): ListFilter {
  const item = PRODUCTS.find((p) => p.id === q.item);
  if (item) return { kind: "item", key: item.id };
  if (q.aisle === "everything") return { kind: "full" };
  const s = SECTIONS.find((x) => x.key === q.aisle);
  return s ? { kind: "aisle", key: s.key } : { kind: "everyone" };
}

/** Whether someone's offset items fit a filter. An aisle matches anyone with something in it; an item, anyone who offset it. */
export function matches(items: ListItem[], f: ListFilter): boolean {
  if (f.kind === "everyone") return true;
  if (f.kind === "full") return badgesFor(items).some((b) => b.kind === "full");
  if (f.kind === "item") return items.some((i) => i.productId === f.key);
  return items.some((i) => PRODUCTS.find((p) => p.id === i.productId)?.section === f.key);
}

/** How many people fit each filter, keyed "everything", a section key, or "item:<id>". */
export function filterCounts(people: ListItem[][]): Record<string, number> {
  const counts: Record<string, number> = { everything: 0 };
  for (const s of SECTIONS) counts[s.key] = 0;
  for (const items of people) {
    if (matches(items, { kind: "full" })) counts.everything++;
    for (const s of SECTIONS) if (matches(items, { kind: "aisle", key: s.key })) counts[s.key]++;
    for (const i of new Set(items.map((x) => x.productId))) counts[`item:${i}`] = (counts[`item:${i}`] ?? 0) + 1;
  }
  return counts;
}

/** "for life", "through Oct 2027", or "past use". */
export function termLabel(until: string | null | "monthly"): string {
  if (until === null) return "for life";
  if (until === "monthly") return "each month";
  if (until === PAST) return "past use";
  return `through ${new Date(until).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`;
}
