import { CHARITIES } from "./charities";
import type { ImpactKey } from "./footprint";
import { BILLING, type Billing, cardFee, MIN_DONATION_USD, paymentFee, type PaymentMode, sponsorRate } from "./pricing";
import { defaultPastYears, harmSplit, type HarmSplit, PAST_MONTHLY_CAP_USD, PAST_YEARS, type PastYears, type PlanLine, planTotals } from "./store";
import type { Context } from "./store";

// How people pay. For now each charity is paid through Every.org directly, a free
// 501(c)(3) donation platform that sends its own receipt for each gift (Ian,
// 2026-10-12). A fiscal sponsor may come later; then payLink() is the one place
// that would point at the sponsor's single checkout instead.

export type { PaymentMode };
export const PAYMENT_MODE: PaymentMode = "every";

/** Payments are off until NEXT_PUBLIC_PAYMENTS_ON is "1"; until then nothing is chargeable. */
export const paymentsOn = () => process.env.NEXT_PUBLIC_PAYMENTS_ON === "1";

/** The fee on one payment in the current mode: the card fee, plus the sponsor's share once there is one. */
export const feeFor = (donation: number, mode: PaymentMode = PAYMENT_MODE) => paymentFee(donation, sponsorRate(mode));

/**
 * Every.org nonprofit slugs, each checked against its every.org page (2026-10-12).
 * A charity missing here can't be paid through Every.org and is left out of checkout.
 */
export const EVERY_SLUGS: Partial<Record<ImpactKey, string>> = {
  carbon: "cleanaircatf", // Clean Air Task Force, EIN 04-3512550
  air: "cleanaircatf", // Clean Air Task Force too: one gift covers carbon and air
  water: "colorado-water-trust", // Colorado Water Trust, EIN 84-1606567
  land: "rainforest-trust", // Rainforest Trust, EIN 13-3500609
  ewaste: "pcs-for-people", // PCs for People, EIN 26-2066045
};

const HARM_ORDER: ImpactKey[] = ["carbon", "air", "water", "land", "ewaste"];

export type Frequency = "ONCE" | "MONTHLY" | "YEARLY";

/** One payment to one charity. */
export interface PayRow {
  /** The charity's key, with "-repeat" on a repeating gift: "carbon", "carbon-repeat". */
  key: string;
  charity: ImpactKey;
  /** The harms this gift pays for: every harm whose charity this is. */
  harms: ImpactKey[];
  donation: number;
  fee: number;
  total: number;
  frequency: Frequency;
}

const upToCent = (n: number) => Math.ceil(n * 100 - 1e-6) / 100;

/** The first harm paid to the same Every.org charity as k, so harms sharing a charity share one gift. */
const payee = (k: ImpactKey) => HARM_ORDER.find((h) => EVERY_SLUGS[h] === EVERY_SLUGS[k]) ?? k;

/** Adds up per-harm amounts by the charity that receives them, keeping which harms each covers. */
function byPayee(amounts: Partial<Record<ImpactKey, number>>) {
  const groups = new Map<ImpactKey, { amount: number; harms: ImpactKey[] }>();
  for (const k of HARM_ORDER) {
    const a = amounts[k] ?? 0;
    if (!EVERY_SLUGS[k] || a < 0.005) continue;
    const g = groups.get(payee(k)) ?? { amount: 0, harms: [] };
    g.amount += a;
    g.harms.push(k);
    groups.set(payee(k), g);
  }
  return groups;
}

/**
 * Turns a plan's per-harm amounts into one payment per charity. Harms worth
 * nothing are skipped, and harms paid to the same charity go in one gift. Every
 * harm's money goes to its own charity, even a small share, which is rounded up
 * to the smallest donation (Ian, 2026-10-12: never to another harm's charity).
 */
function rowsFor(amounts: Record<ImpactKey, number>, frequency: Frequency, suffix: string, mode: PaymentMode): PayRow[] {
  return [...byPayee(amounts)].map(([k, g]) => {
    const donation = Math.max(MIN_DONATION_USD, upToCent(g.amount));
    const fee = feeFor(donation, mode);
    return { key: `${k}${suffix}`, charity: k, harms: g.harms, donation, fee, total: Math.round((donation + fee) * 100) / 100, frequency };
  });
}

/**
 * The payments that settle a plan, one per charity. Without autopay everything
 * due now (past use, lifetime and the first month or year) goes in one gift to
 * each charity. With autopay, the repeating part is its own gift that Every.org
 * charges again each month or year.
 */
export function payRows(split: HarmSplit, billing: Billing, autopay: boolean, mode: PaymentMode = PAYMENT_MODE): PayRow[] {
  const pick = (f: (k: ImpactKey) => number) => Object.fromEntries(HARM_ORDER.map((k) => [k, f(k)])) as Record<ImpactKey, number>;
  if (!autopay) return rowsFor(pick((k) => split[k].once + split[k].perPeriod), "ONCE", "", mode);
  return [
    ...rowsFor(pick((k) => split[k].once), "ONCE", "", mode),
    ...rowsFor(pick((k) => split[k].perPeriod), billing === "annual" ? "YEARLY" : "MONTHLY", "-repeat", mode),
  ];
}

/** One-time gifts for these per-harm amounts, one per charity, each rounded up to the smallest donation. */
export const onceRows = (amounts: Partial<Record<ImpactKey, number>>, mode: PaymentMode = PAYMENT_MODE) =>
  rowsFor(Object.fromEntries(HARM_ORDER.map((k) => [k, amounts[k] ?? 0])) as Record<ImpactKey, number>, "ONCE", "", mode);

/** What a plan costs again each month or year, one gift per charity. */
export const repeatRows = (split: HarmSplit, billing: Billing, mode: PaymentMode = PAYMENT_MODE) =>
  payRows(split, billing, true, mode).filter((r) => r.frequency !== "ONCE");

/**
 * The default spread for past use: of the spreads that keep it at or under the
 * monthly cap, the one that costs least in total over the longest spread once every
 * charity's gift is rounded up to the smallest donation and given its fee
 * (Ian, 2026-10-12). Spreading a little can lift small monthly gifts to $1 that
 * would otherwise be rounded up for nothing; ties go to the shortest spread.
 */
export function bestPastYears(plan: PlanLine[], ctx: Context, billing: Billing, mode: PaymentMode = PAYMENT_MODE): PastYears {
  const base = planTotals(plan, ctx, billing, 0);
  const past = base.lines.reduce((s, l) => s + (l.cover.ahead === "monthly" ? l.pastCost : 0), 0);
  if (!(past > 0)) return 0;
  const months = 12 * PAST_YEARS[PAST_YEARS.length - 1];
  const perPeriod = billing === "annual" ? 12 : 1;
  const paid = (y: PastYears) => {
    const rows = payRows(harmSplit(planTotals(plan, ctx, billing, y), ctx, billing), billing, true, mode);
    const plainRepeat = y ? payRows(harmSplit(base, ctx, billing), billing, true, mode).filter((r) => r.frequency !== "ONCE") : [];
    const once = sumTotal(rows.filter((r) => r.frequency === "ONCE"));
    const repeat = sumTotal(rows.filter((r) => r.frequency !== "ONCE"));
    return once + repeat * ((12 * (y || months / 12)) / perPeriod) + (y ? sumTotal(plainRepeat) * ((months - 12 * y) / perPeriod) : 0);
  };
  const first = defaultPastYears(past);
  const allowed = PAST_YEARS.filter((y) => (y === 0 ? past <= PAST_MONTHLY_CAP_USD : y >= first));
  return allowed.reduce((best, y) => (paid(y) < paid(best) - 0.005 ? y : best), allowed[0]);
}

export const sumTotal = (rows: PayRow[]) => Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100;

/** The card fees for giving these amounts to the charities one payment each, as Every.org charges them. */
export function perCharityFees(amounts: Partial<Record<ImpactKey, number>>): number {
  return Math.round([...byPayee(amounts).values()].reduce((s, g) => s + cardFee(g.amount), 0) * 100) / 100;
}

/** "carbon and air pollution", for a row's covers line. */
export const harmsText = (harms: ImpactKey[], label: (k: ImpactKey) => string) => {
  const names = harms.map(label);
  return names.length < 2 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

export interface DonateLinkInput {
  slug: string;
  amount: number;
  frequency: Frequency;
  partnerDonationId: string;
  partnerMetadata?: Record<string, string | number>;
  webhookToken?: string;
  successUrl: string;
  exitUrl?: string;
}

// Plan ids and row keys are plain ASCII, which btoa takes as is.
const base64 = (s: string) => btoa(s);

/**
 * An Every.org donate link, in the format of docs.every.org/docs/donate-link:
 * https://www.every.org/<slug>?amount=…&frequency=…#donate. Metadata is
 * base64-encoded JSON, which Every.org decodes and sends back in the webhook.
 */
export function everyDonateUrl(i: DonateLinkInput, host = "https://www.every.org"): string {
  const q = new URLSearchParams();
  q.set("amount", i.amount.toFixed(2));
  q.set("frequency", i.frequency);
  q.set("partner_donation_id", i.partnerDonationId);
  if (i.partnerMetadata) q.set("partner_metadata", base64(JSON.stringify(i.partnerMetadata)));
  if (i.webhookToken) q.set("webhook_token", i.webhookToken);
  q.set("success_url", i.successUrl);
  if (i.exitUrl) q.set("exit_url", i.exitUrl);
  return `${host}/${encodeURIComponent(i.slug)}?${q.toString()}#donate`;
}

/** Ties a gift to a checkout: the plan's random id and the row's key. */
export const partnerDonationId = (planId: string, rowKey: string) => `${planId}.${rowKey}`;
export const PLAN_ID = /^[a-z0-9]{12,40}$/;

/** Where the person pays for one row. The one place a sponsor's single link would go later. */
export function payLink(planId: string, row: PayRow, origin: string, mode: PaymentMode = PAYMENT_MODE, returnPath = "/checkout/return"): string | null {
  if (mode !== "every") return null; // No sponsor yet.
  const slug = EVERY_SLUGS[row.charity];
  if (!slug) return null;
  const back = (extra: string) => `${origin}${returnPath}?plan=${encodeURIComponent(planId)}${extra}`;
  return everyDonateUrl({
    slug,
    amount: row.total,
    frequency: row.frequency,
    partnerDonationId: partnerDonationId(planId, row.key),
    partnerMetadata: { plan: planId, row: row.key },
    webhookToken: process.env.NEXT_PUBLIC_EVERY_WEBHOOK_TOKEN || undefined,
    successUrl: back(`&charity=${encodeURIComponent(row.key)}`),
    exitUrl: back(""),
  });
}

export const charityName = (row: PayRow) => CHARITIES[row.charity].name;
export const frequencyText = (row: PayRow) =>
  row.frequency === "ONCE" ? "once" : row.frequency === "MONTHLY" ? BILLING.monthly.per : BILLING.annual.per;

// Progress through a checkout, kept in this browser so the person can stop and come back.

export const CHECKOUT_KEY = "offset:checkout:v1";

export interface Checkout {
  id: string;
  created: string;
  billing: Billing;
  rows: PayRow[];
  /** Items paid for, to mark covered once every gift is confirmed. */
  lines: { productId: string; lifetime: boolean; past?: boolean }[];
  /** Rows the person came back from Every.org on, with when. */
  done: Record<string, string>;
  /** Rows whose gift Every.org's webhook has confirmed. */
  confirmed: Record<string, true>;
  /** Set once covered items have been marked from this checkout. */
  applied?: boolean;
  /** Where Every.org sends the person back to, when not the plan's own return page (a gift's page). */
  returnPath?: string;
  /** What the plan was priced from, so a steady gift can be checked against measured use later. Kept in this browser only. */
  plan?: { lines: PlanLine[]; ctx: Context; pastYears: PastYears };
}

export function newPlanId(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function loadCheckout(): Checkout | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_KEY);
    const c = raw ? (JSON.parse(raw) as Checkout) : null;
    return c && PLAN_ID.test(c.id) && Array.isArray(c.rows) ? { ...c, done: c.done ?? {}, confirmed: c.confirmed ?? {} } : null;
  } catch {
    return null;
  }
}

export function saveCheckout(c: Checkout | null) {
  try {
    if (c) localStorage.setItem(CHECKOUT_KEY, JSON.stringify(c));
    else localStorage.removeItem(CHECKOUT_KEY);
  } catch {
    // Storage blocked: progress lasts only while the page is open.
  }
}

/** The row to pay next: the first one the person hasn't come back from. */
export const nextRow = (c: Checkout) => c.rows.find((r) => !c.done[r.key] && !c.confirmed[r.key]) ?? null;
export const allConfirmed = (c: Checkout) => c.rows.length > 0 && c.rows.every((r) => c.confirmed[r.key]);

/** Asks the server which of a checkout's gifts Every.org has confirmed. */
export async function fetchConfirmed(planId: string): Promise<string[]> {
  try {
    const r = await fetch(`/api/every-webhook/status?plan=${encodeURIComponent(planId)}`, { cache: "no-store" });
    if (!r.ok) return [];
    const d = (await r.json()) as { paid?: unknown };
    return Array.isArray(d.paid) ? d.paid.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
