import type { ListItem } from "./publicList";
import { PRODUCTS, SECTIONS, type SectionKey } from "./store";

// Badges (Ian, 2026-10-13): one system everywhere a badge shows. Fully Offset
// for everything in the store, "<aisle> offset" for a whole aisle, and one per
// item otherwise. Each is for life or through a date. Never "carbon neutral".

export type BadgeKind = "full" | "aisle" | "item";

export interface BadgeInfo {
  kind: BadgeKind;
  /** "full", a section key, or a product id. */
  key: string;
  /** What the seal names, e.g. "AI" or "Video streaming"; "Fully" for the full badge. */
  name: string;
  /** ISO date the cover ends, null for life. A badge made of several items lasts as long as the shortest. */
  until: string | null;
}

export const FULL_NAME = "Fully Offset";

const itemsIn = (section: SectionKey) => PRODUCTS.filter((p) => p.section === section);

/** The shortest cover among several: null (for life) only when every one is for life. */
function shortest(untils: (string | null)[]): string | null {
  const dated = untils.filter((u): u is string => u !== null).sort();
  return dated[0] ?? null;
}

/**
 * The badges a set of offset items earns, biggest first: Fully Offset when every item
 * in the store is offset, then each whole aisle, then items outside a whole aisle.
 */
export function badgesFor(items: ListItem[]): BadgeInfo[] {
  const until = new Map(items.map((i) => [i.productId, i.until]));
  const has = (id: string) => until.has(id);
  if (PRODUCTS.every((p) => has(p.id))) return [{ kind: "full", key: "full", name: FULL_NAME, until: shortest(PRODUCTS.map((p) => until.get(p.id)!)) }];
  const out: BadgeInfo[] = [];
  const loose: BadgeInfo[] = [];
  for (const s of SECTIONS) {
    const inAisle = itemsIn(s.key);
    if (inAisle.every((p) => has(p.id))) out.push({ kind: "aisle", key: s.key, name: s.title, until: shortest(inAisle.map((p) => until.get(p.id)!)) });
    else for (const p of inAisle) if (has(p.id)) loose.push({ kind: "item", key: p.id, name: p.name, until: until.get(p.id)! });
  }
  return [...out, ...loose];
}

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

/** "for life", or "through Oct 2027". */
export function termLabel(until: string | null | "monthly"): string {
  if (until === null) return "for life";
  if (until === "monthly") return "each month";
  return `through ${new Date(until).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}`;
}
