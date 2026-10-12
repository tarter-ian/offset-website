import { payRows, PLAN_ID, type PayRow } from "./payments";
import { aheadFor, DEFAULT_CONTEXT, defaultAmount, harmSplit, planTotals, PRODUCTS, productById, type Product } from "./store";

// Gifting an offset: one person pays the charities for someone else's typical
// use of one item, for a year or for life (Ian, 2026-10-12). The giver gets a
// link to send; the person who opens it can mark the item as covered.

export type GiftSpan = "year" | "life";

export interface Gift {
  id: string;
  productId: string;
  span: GiftSpan;
  from: string;
  to: string;
  note: string;
  createdAt: string;
}

export const GIFT_LIMITS = { from: 40, to: 40, note: 200 } as const;

/** Spans a product can be gifted for at typical use: a year always, for life where lifetime is offered. */
export function giftSpans(p: Product): GiftSpan[] {
  const amount = defaultAmount(p, DEFAULT_CONTEXT);
  if (!(p.cost(amount, "monthly", DEFAULT_CONTEXT) > 0)) return [];
  return aheadFor(p, amount, DEFAULT_CONTEXT).includes("lifetime") ? ["year", "life"] : ["year"];
}

export const GIFTABLE = PRODUCTS.filter((p) => giftSpans(p).length > 0);

/**
 * The gifts to each charity that pay for a gift, at typical use for the US.
 * Worked out the same way on the server, so a gift link can't claim more than was paid.
 */
export function giftRows(productId: string, span: GiftSpan): PayRow[] {
  const p = productById(productId);
  if (!p || !giftSpans(p).includes(span)) return [];
  const amount = defaultAmount(p, DEFAULT_CONTEXT);
  const billing = span === "year" ? "annual" : "monthly";
  const totals = planTotals([{ productId, amount, cover: { past: false, ahead: span === "life" ? "lifetime" : "monthly" } }], DEFAULT_CONTEXT, billing);
  return payRows(harmSplit(totals, DEFAULT_CONTEXT, billing), billing, false);
}

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Checks what the giver sent. Names are required; the note is optional. */
export function parseGift(body: unknown, now = new Date()): { ok: true; gift: Gift } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Body isn't a JSON object." };
  const b = body as Record<string, unknown>;
  if (typeof b.id !== "string" || !PLAN_ID.test(b.id)) return { ok: false, error: "Bad gift id." };
  if (typeof b.productId !== "string" || !productById(b.productId)) return { ok: false, error: "Unknown item." };
  if (b.span !== "year" && b.span !== "life") return { ok: false, error: "Unknown span." };
  if (!giftRows(b.productId, b.span).length) return { ok: false, error: "That item can't be gifted that way." };
  const from = clean(b.from, GIFT_LIMITS.from);
  const to = clean(b.to, GIFT_LIMITS.to);
  if (!from || !to) return { ok: false, error: "Add both names." };
  return { ok: true, gift: { id: b.id, productId: b.productId, span: b.span, from, to, note: clean(b.note, GIFT_LIMITS.note), createdAt: now.toISOString() } };
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

/** "AI chat for life", for the gift card. */
export const giftLabel = (g: Pick<Gift, "productId" | "span">) => `${productById(g.productId)?.name ?? "An offset"} ${g.span === "life" ? "for life" : "for a year"}`;
