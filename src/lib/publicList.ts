import { type Billing } from "./pricing";
import { giftUntil, type Gift } from "./gifts";
import { PAST_YEARS, harmSplit, planTotals, productById, type Context, type PastYears, type PlanLine } from "./store";
import { payRows, PLAN_ID, type PayRow } from "./payments";

// The public list (Ian, 2026-10-12): people who chose to be listed, with a name
// they pick, what they've covered and since when. No dollar amounts. Someone is
// shown only once Every.org has confirmed every gift of a checkout, and a gift's
// recipient is listed only if they opt in themselves. Leaving is one tap.

export const LIST_NAME_MAX = 40;

/** A covered item on the list: for life, or through a date. */
export interface ListItem {
  productId: string;
  /** ISO date the cover ends, or null for life. */
  until: string | null;
}

/** One paid-for checkout or gift behind a listing. */
export interface Claim {
  source: "plan" | "gift";
  sourceId: string;
  rows: PayRow[];
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

/** What covered items a checkout pays for: lifetime items for life, the rest for the billing period from when it was made. */
export function planItems(lines: PlanLine[], billing: Billing, createdAt: string): ListItem[] {
  const until = new Date(createdAt);
  if (billing === "annual") until.setFullYear(until.getFullYear() + 1);
  else until.setMonth(until.getMonth() + 1);
  return lines.map((l) => ({ productId: l.productId, until: l.cover.ahead === "lifetime" ? null : until.toISOString() }));
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

export function planRows(i: PlanClaimInput): PayRow[] {
  return payRows(harmSplit(planTotals(i.lines, i.ctx, i.billing, i.pastYears), i.ctx, i.billing), i.billing, i.autopay);
}

/** Whether rows the browser showed match the server's own: same charities, same gifts to the cent. */
export function sameRows(a: PayRow[], b: unknown): boolean {
  if (!Array.isArray(b) || a.length !== b.length) return false;
  return a.every((r) => (b as PayRow[]).some((x) => x?.key === r.key && Math.abs(Number(x.donation) - r.donation) < 0.011));
}

/** A person's badges: the best cover for each item across their paid claims, dropping covers that have ended. */
export function badges(claims: Claim[], now = new Date()): ListItem[] {
  const best = new Map<string, string | null>();
  for (const c of claims)
    for (const i of c.items) {
      if (i.until !== null && Date.parse(i.until) < now.getTime()) continue;
      const had = best.get(i.productId);
      if (had === null) continue;
      best.set(i.productId, i.until === null || had === undefined || i.until > had ? i.until : had);
    }
  return [...best].map(([productId, until]) => ({ productId, until }));
}
