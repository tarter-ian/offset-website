import { type Billing } from "./pricing";
import { giftUntil, type Gift } from "./gifts";
import { PAST_YEARS, PRODUCTS, harmSplit, planTotals, productById, type Context, type PastYears, type PlanLine } from "./store";
import { fundGifts, fundOwed, type Owed, PAYMENT_MODE, payRows, PLAN_ID } from "./payments";
import type { PaymentMode } from "./pricing";

// The public list (Ian, 2026-10-12): people who chose to be listed, with a name
// they pick, what they've covered and since when. No dollar amounts. Someone is
// shown only once every gift of a checkout is confirmed, and a gift's
// recipient is listed only if they opt in themselves. Leaving is one tap.

export const LIST_NAME_MAX = 40;

/** The term of an item whose dated cover has ended but whose past use was paid for. */
export const PAST = "past";

/** A covered item on the list: for life, or through a date. */
export interface ListItem {
  productId: string;
  /** ISO date the cover ends, or null for the future for life. On a person's badges, "past" once only past use is left. */
  until: string | null;
  /**
   * Whether past use was paid off in full, not in instalments still running: a yellow badge, or green
   * beside a future for life (Ian, 2026-10-13). Missing on claims saved before 2026-10-13.
   */
  past?: boolean;
  /** Offset because the person uses none of it, with nothing paid. */
  zero?: true;
}

/** One paid-for checkout or gift behind a listing. */
export interface Claim {
  /** "zero" holds the items the person uses none of: one per person, replaced on each update, never paid. */
  source: "plan" | "gift" | "zero";
  sourceId: string;
  /** What must arrive for it to count: each Every.org gift, or the one gift to the fund. */
  rows: Owed[];
  items: ListItem[];
  createdAt: string;
}

export const cleanName = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, LIST_NAME_MAX) : "");

/** A random edit token: the only key to changing or leaving a listing. */
export function newToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Tokens are kept hashed, so the database alone can't be used to edit anyone's listing. */
export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const TOKEN = /^[0-9a-f]{48}$/;

/**
 * What covered items a checkout pays for: lifetime items for life, the rest for the billing period from when it was made.
 * A dated item notes past use only when this checkout paid all of it, not when it is spread over years.
 */
export function planItems(lines: PlanLine[], billing: Billing, createdAt: string, pastYears: PastYears = 0): ListItem[] {
  const until = new Date(createdAt);
  if (billing === "annual") until.setFullYear(until.getFullYear() + 1);
  else until.setMonth(until.getMonth() + 1);
  return lines.map((l) =>
    l.cover.ahead === "lifetime"
      ? // A lifetime item's past use is paid with it, all at once.
        { productId: l.productId, until: null, ...(l.cover.past ? { past: true } : {}) }
      : { productId: l.productId, until: until.toISOString(), ...(l.cover.past && pastYears === 0 ? { past: true } : {}) },
  );
}

export function giftItems(gift: Gift): ListItem[] {
  return gift.items.map((i) => ({ productId: i.productId, until: giftUntil(i, gift.createdAt) }));
}

/** The checkout a plan makes, worked out again on the server, so a listing can't claim a plan bigger than what was paid. */
export interface PlanClaimInput {
  planId: string;
  lines: PlanLine[];
  ctx: Context;
  billing: Billing;
  pastYears: PastYears;
  autopay: boolean;
}

export function parsePlanClaim(b: Record<string, unknown>): PlanClaimInput | null {
  if (typeof b.planId !== "string" || !PLAN_ID.test(b.planId)) return null;
  if (b.billing !== "monthly" && b.billing !== "annual") return null;
  if (!Array.isArray(b.lines) || !b.lines.length || b.lines.length > 60) return null;
  const lines: PlanLine[] = [];
  for (const raw of b.lines as Record<string, unknown>[]) {
    const p = typeof raw?.productId === "string" ? productById(raw.productId) : undefined;
    const cover = raw?.cover as Record<string, unknown> | undefined;
    if (!p || !cover || (cover.ahead !== "monthly" && cover.ahead !== "lifetime")) return null;
    const amount = raw.amount;
    if (p.amount.kind === "number" ? typeof amount !== "number" || !Number.isFinite(amount) || amount < 0 : typeof amount !== "string") return null;
    lines.push({ productId: p.id, amount: amount as number | string, cover: { past: cover.past === true, ahead: cover.ahead } });
  }
  const ctx = b.ctx as Context | undefined;
  if (!ctx || typeof ctx !== "object" || typeof ctx.birthYear !== "number" || typeof ctx.state !== "string") return null;
  const pastYears = PAST_YEARS.includes(b.pastYears as PastYears) ? (b.pastYears as PastYears) : 0;
  return { planId: b.planId, lines, ctx, billing: b.billing, pastYears, autopay: b.autopay === true };
}

/**
 * What a plan's checkout owes, in the site's payment mode: the list checks the same
 * records the checkout does (Ian, 2026-10-13), so in Endaoment mode that's the one
 * gift to the fund. Nothing repeats on its own there, so autopay plays no part.
 */
export function planRows(i: PlanClaimInput, mode: PaymentMode = PAYMENT_MODE): Owed[] {
  const split = harmSplit(planTotals(i.lines, i.ctx, i.billing, i.pastYears), i.ctx, i.billing);
  if (mode === "endaoment") {
    const { today } = fundGifts(split);
    return today.donation > 0 ? fundOwed(today) : [];
  }
  return payRows(split, i.billing, i.autopay, mode);
}

/** Whether rows the browser showed match the server's own: same gifts to the cent. */
export function sameRows(a: Owed[], b: unknown): boolean {
  if (!Array.isArray(b) || a.length !== b.length) return false;
  return a.every((r) => (b as Owed[]).some((x) => x?.key === r.key && Math.abs(Number(x.donation) - r.donation) < 0.011));
}

/**
 * A person's badges: for each item across their paid claims, the furthest future still paid
 * (for life beats a date, a later date an earlier one) and whether any paid its past off. A
 * cover that has ended leaves a past-use badge when its past use was paid, and nothing otherwise.
 */
export function badges(claims: Claim[], now = new Date()): ListItem[] {
  const best = new Map<string, { future: string | null | undefined; past: boolean }>();
  const further = (a: string | null | undefined, b: string | null | undefined) => (a === null || b === undefined || (b !== null && a !== undefined && a > b) ? a : b);
  for (const c of claims)
    for (const i of c.items) {
      const ended = i.until !== null && (i.until === PAST || Date.parse(i.until) < now.getTime());
      const had = best.get(i.productId) ?? { future: undefined, past: false };
      best.set(i.productId, { future: further(ended ? undefined : i.until, had.future), past: had.past || !!i.past });
    }
  return [...best]
    .filter(([, b]) => b.future !== undefined || b.past)
    .map(([productId, b]) => ({ productId, until: b.future === undefined ? PAST : b.future, ...(b.past ? { past: true } : {}) }));
}

/**
 * The items someone says they use none of, as the browser sends them: names only, never
 * amounts (Ian, 2026-10-13). Null when it isn't a list of the store's own items. Each item
 * counts once, so the list can never hold more than the store does.
 */
export function parseZeroUse(v: unknown): string[] | null {
  if (!Array.isArray(v) || v.length > 2 * PRODUCTS.length || !v.every((id) => typeof id === "string" && productById(id))) return null;
  return PRODUCTS.filter((p) => v.includes(p.id)).map((p) => p.id);
}

/**
 * Items at zero use count as offset for life (Ian, 2026-10-13: "if it's at 0 they auto-get
 * those badges"), but only beside something actually offset, so nobody gets a badge for
 * giving nothing. A paid badge keeps its own term: zero use only fills items with none.
 */
export function withZeroUse(paid: ListItem[], zero: string[]): ListItem[] {
  if (!paid.length) return paid;
  const has = new Set(paid.map((i) => i.productId));
  const added = PRODUCTS.filter((p) => zero.includes(p.id) && !has.has(p.id)).map((p) => ({ productId: p.id, until: null, zero: true as const }));
  return [...paid, ...added];
}

/** The list shows its "Find a name" box from this many people up (Ian, 2026-10-13). */
export const SEARCH_FROM = 20;

/** Folds case and accents, so "zoe" finds "Zoë". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Whether a listed name fits what was typed in "Find a name": anywhere in it, case and accents aside. Nothing typed fits everyone. */
export const nameMatches = (name: string, query: string) => fold(name).includes(fold(query));

/**
 * What "Find a name" starts with, from the page's `q` parameter, so a search survives a filter
 * change and can be shared (Ian, 2026-10-13). No longer than a name can be.
 */
export const parseQuery = (v: unknown): string => {
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === "string" ? s.slice(0, LIST_NAME_MAX) : "";
};

/** The page's query string with `q` set to what was typed, or dropped when nothing is. Other parameters stay. */
export function withQuery(search: string, query: string): string {
  const p = new URLSearchParams(search);
  if (query.trim()) p.set("q", query);
  else p.delete("q");
  const s = p.toString();
  return s ? `?${s}` : "";
}
