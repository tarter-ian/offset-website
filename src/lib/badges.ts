import { type Covered, STORAGE_KEY } from "./covered";
import { type ListItem, PAST, withZeroUse } from "./publicList";
import { inForce, untilOf } from "./record";
import { type Context, DEFAULT_CONTEXT, defaultAmount, type Product, PRODUCTS, SECTIONS, type SectionKey } from "./store";

export { PAST };

// Badges (Ian, 2026-10-13): one system everywhere a badge shows. Fully Offset
// for everything in the store, "<aisle> offset" for a whole aisle, and one per
// item otherwise. Never "carbon neutral".
//
// The term (Ian, 2026-10-13): blue while the future is being paid for, through
// a date for a month or year, or "rest of life" when the future is paid for life
// but past use isn't. Yellow once past use is paid off in full (not while
// instalments run). Green only when past and future are both paid for life, or
// the item is at zero use. An item with past paid and its future running shows
// two badges, yellow and blue; green replaces both.

/** The term of a future paid for life without past use: a blue badge. */
export const REST = "rest";

export type BadgeKind = "full" | "aisle" | "item";

export interface BadgeInfo {
  kind: BadgeKind;
  /** "full", a section key, or a product id. Two badges (yellow and blue) can share one. */
  key: string;
  /** What the seal names, e.g. "AI" or "Video streaming"; "Fully" for the full badge. */
  name: string;
  /** null for past and future for life (green), REST or an ISO date for the future (blue), PAST for past use paid (yellow). */
  until: string | null;
  /** The key of the higher badge ("full" or an aisle) this one was earned inside, so it folds under it. */
  within?: string;
}

/** A badge's color says its term (Ian, 2026-10-13): green for everything for life, blue for the future, yellow for the past. */
export type Tone = "life" | "period" | "past";
export const toneOf = (until: string | null): Tone => (until === null ? "life" : until === PAST ? "past" : "period");

export const FULL_NAME = "Fully Offset";

const itemsIn = (section: SectionKey) => PRODUCTS.filter((p) => p.section === section);

/** Where one item, or every item of a group, stands: past paid off, and how far the future is paid. */
interface Standing {
  green: boolean;
  past: boolean;
  /** null for life, an ISO date, or undefined when nothing ahead is paid. */
  future: string | null | undefined;
}

function standing(i: ListItem): Standing {
  const green = !!i.zero || (i.until === null && !!i.past);
  return { green, past: green || !!i.past || i.until === PAST, future: i.until === PAST ? undefined : i.until };
}

/**
 * A group's standing (Ian, 2026-10-13): green only when every item is; its past is paid when
 * every item's is; its future runs as long as the shortest, and only when every item has one.
 */
function together(ss: Standing[]): Standing {
  const future = ss.some((s) => s.future === undefined)
    ? undefined
    : (ss.map((s) => s.future).filter((f): f is string => f !== null).sort()[0] ?? null);
  return { green: ss.every((s) => s.green), past: ss.every((s) => s.past), future };
}

/** The terms a standing shows: green alone, or yellow and blue, each when it holds. */
function terms(s: Standing): (string | null)[] {
  if (s.green) return [null];
  return [...(s.past ? [PAST] : []), ...(s.future === undefined ? [] : [s.future ?? REST])];
}

/**
 * Every badge a set of offset items earns, biggest first: Fully Offset when every item
 * in the store is offset, then each whole aisle, then each item. Items a person uses none
 * of come in already offset (see `withZeroUse`), so "every item" is the whole store for
 * everyone. A group whose items share neither a paid past nor a running future earns no
 * group badge; its items stand on their own.
 *
 * A higher badge earns every lower one inside it too (Ian, 2026-10-13), marked `within` it
 * and shown in its colors, "just one color": so a green Fully Offset's aisles and items are
 * green, and a green badge never also shows a yellow or blue copy.
 */
export function badgesFor(items: ListItem[]): BadgeInfo[] {
  const held = new Map(items.map((i) => [i.productId, standing(i)]));
  const group = (ps: Product[]) => (ps.length && ps.every((p) => held.has(p.id)) ? terms(together(ps.map((p) => held.get(p.id)!))) : []);
  const badge = (kind: BadgeKind, key: string, name: string, within?: string) => (until: string | null) => ({ kind, key, name, until, ...(within ? { within } : {}) });
  const full = group(PRODUCTS);
  const out: BadgeInfo[] = full.map(badge("full", "full", FULL_NAME));
  const lower: BadgeInfo[] = [];
  for (const s of SECTIONS) {
    const inAisle = itemsIn(s.key);
    const aisle = full.length ? full : group(inAisle);
    if (aisle.length) out.push(...aisle.map(badge("aisle", s.key, s.title, full.length ? "full" : undefined)));
    for (const p of inAisle) {
      if (!held.has(p.id)) continue;
      const own = aisle.length ? aisle : terms(held.get(p.id)!);
      lower.push(...own.map(badge("item", p.id, p.name, aisle.length ? s.key : undefined)));
    }
  }
  return [...out, ...lower];
}

/** The badges to show up front: those not earned inside a higher one. */
export const topBadges = (all: BadgeInfo[]) => all.filter((b) => !b.within);

/** A unique key for a badge in a row, since yellow and blue can share an item. */
export const badgeKey = (b: BadgeInfo) => `${b.kind}:${b.key}:${b.until ?? "life"}`;

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

/**
 * The items a person uses none of at their own amounts, like AI video for someone who
 * makes none: there's nothing to offset, so they count as offset (Ian, 2026-10-13). It is
 * worked out fresh from the amounts each time, so once use goes above zero the item is
 * something to offset again and its badge goes.
 */
export function zeroUse(amounts: Record<string, number | string>, ctx: Context): string[] {
  const need = new Set(toOffset(amounts, ctx));
  return PRODUCTS.filter((p) => !need.has(p.id)).map((p) => p.id);
}

/**
 * This browser's saved amounts, read for badges: what there is to offset and what's at zero
 * use. `saved` is false when no amounts were saved here, so the defaults stood in.
 */
export function savedUse(): { needed: string[]; zero: string[]; saved: boolean } {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as { amounts?: Record<string, number | string>; ctx?: Partial<Context> };
    const ctx = { ...DEFAULT_CONTEXT, ...s.ctx };
    return { needed: toOffset(s.amounts ?? {}, ctx), zero: zeroUse(s.amounts ?? {}, ctx), saved: !!s.amounts };
  } catch {
    return { needed: toOffset({}, DEFAULT_CONTEXT), zero: zeroUse({}, DEFAULT_CONTEXT), saved: false };
  }
}

/**
 * What's offset now, as badges read it: in force (autopay rolled on to its next renewal), past
 * use paid for on a cover that has ended, and beside those, the items at zero use.
 */
export function offsetItems(covered: Record<string, Covered>, now: number, zero: string[] = []): ListItem[] {
  const paid = Object.entries(covered)
    .filter(([, c]) => inForce(c, now) || c.past)
    .map(([productId, c]) => ({
      productId,
      until: c.kind === "life" ? null : inForce(c, now) ? untilOf(c, now) : PAST,
      ...(c.past ? { past: true } : {}),
    }));
  return withZeroUse(paid, zero);
}

/** The Fully Offset badges (green, or yellow and blue, or one of those), when everything is offset or at zero use; empty otherwise. */
export const fullBadges = (covered: Record<string, Covered>, zero: string[], now: number): BadgeInfo[] =>
  badgesFor(offsetItems(covered, now, zero)).filter((b) => b.kind === "full");

/** What the list's color chips ask for: green, past paid (yellow or green), or future paid (blue or green). */
export type ListStatus = "life" | "past" | "future";
export const LIST_STATUSES: ListStatus[] = ["life", "past", "future"];

/** A filter on the public list: everyone, a color, Fully Offset, an aisle, or one item. */
export type ListFilter =
  | { kind: "everyone" }
  | { kind: "status"; status: ListStatus }
  | { kind: "full" }
  | { kind: "aisle"; key: SectionKey }
  | { kind: "item"; key: string };

/** Reads `?status=`, `?aisle=` (a section key or "everything") and `?item=` from the list page's address. Anything unknown means everyone. */
export function parseFilter(q: { aisle?: string; item?: string; status?: string }): ListFilter {
  const item = PRODUCTS.find((p) => p.id === q.item);
  if (item) return { kind: "item", key: item.id };
  const status = LIST_STATUSES.find((s) => s === q.status);
  if (status) return { kind: "status", status };
  if (q.aisle === "everything") return { kind: "full" };
  const s = SECTIONS.find((x) => x.key === q.aisle);
  return s ? { kind: "aisle", key: s.key } : { kind: "everyone" };
}

/**
 * Whether someone's offset items fit a filter. An aisle matches anyone with something in it; an item, anyone who offset it.
 * Green is past and future both paid, so it shows under past paid and future paid too (Ian, 2026-10-13).
 */
export function matches(items: ListItem[], f: ListFilter): boolean {
  if (f.kind === "everyone") return true;
  if (f.kind === "status") {
    // By the colors the badges show, so a filter never finds someone without a badge in its color.
    const tones = new Set(badgesFor(items).map((b) => toneOf(b.until)));
    return tones.has("life") || tones.has(f.status === "past" ? "past" : f.status === "future" ? "period" : "life");
  }
  if (f.kind === "full") return badgesFor(items).some((b) => b.kind === "full");
  if (f.kind === "item") return items.some((i) => i.productId === f.key);
  return items.some((i) => PRODUCTS.find((p) => p.id === i.productId)?.section === f.key);
}

/** How many people fit each filter, keyed "everything", "status:<status>", a section key, or "item:<id>". */
export function filterCounts(people: ListItem[][]): Record<string, number> {
  const counts: Record<string, number> = { everything: 0 };
  for (const s of SECTIONS) counts[s.key] = 0;
  for (const s of LIST_STATUSES) counts[`status:${s}`] = 0;
  for (const items of people) {
    if (matches(items, { kind: "full" })) counts.everything++;
    for (const s of LIST_STATUSES) if (matches(items, { kind: "status", status: s })) counts[`status:${s}`]++;
    for (const s of SECTIONS) if (matches(items, { kind: "aisle", key: s.key })) counts[s.key]++;
    for (const i of new Set(items.map((x) => x.productId))) counts[`item:${i}`] = (counts[`item:${i}`] ?? 0) + 1;
  }
  return counts;
}

/** A term inside a sentence: "offset for past use, and through Oct 2027". */
export const termPhrase = (untils: (string | null)[]) =>
  untils.map((u) => (u === PAST ? "for past use" : u === REST ? "for the rest of life" : termLabel(u))).join(", and ");

/** "for life", "rest of life", "through Oct 2027", or "past use". */
export function termLabel(until: string | null | "monthly"): string {
  if (until === null) return "for life";
  if (until === "monthly") return "each month";
  if (until === PAST) return "past use";
  if (until === REST) return "rest of life";
  return `through ${new Date(until).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`;
}
