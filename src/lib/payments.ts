import { CHARITIES } from "./charities";
import type { ImpactKey } from "./footprint";
import { BILLING, type Billing, cardFee, MIN_DONATION_USD, paymentFee, type PaymentMode, sponsorRate } from "./pricing";
import type { HarmSplit } from "./store";

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
  air: "lung", // American Lung Association
  water: "b-e-f", // Bonneville Environmental Foundation, Portland, OR
  land: "rainforest-trust", // Rainforest Trust, EIN 13-3500609
  ewaste: "human-i-t", // human-I-T
};

const HARM_ORDER: ImpactKey[] = ["carbon", "air", "water", "land", "ewaste"];

export type Frequency = "ONCE" | "MONTHLY" | "YEARLY";

/** One payment to one charity. */
export interface PayRow {
  /** The charity's key, with "-repeat" on a repeating gift: "carbon", "carbon-repeat". */
  key: string;
  charity: ImpactKey;
  /** The harms this gift pays for: its own, plus any too small to send on their own. */
  harms: ImpactKey[];
  donation: number;
  fee: number;
  total: number;
  frequency: Frequency;
}

const upToCent = (n: number) => Math.ceil(n * 100 - 1e-6) / 100;

/**
 * Turns a plan's per-harm amounts into one payment per charity. Harms worth
 * nothing are skipped. One worth less than the smallest donation is added to the
 * largest gift instead, since its own 30¢ card fee would eat most of it.
 */
function rowsFor(amounts: Record<ImpactKey, number>, frequency: Frequency, suffix: string, mode: PaymentMode): PayRow[] {
  const live = HARM_ORDER.filter((k) => EVERY_SLUGS[k] && amounts[k] >= 0.005);
  if (!live.length) return [];
  const largest = live.reduce((a, b) => (amounts[b] > amounts[a] ? b : a));
  const small = live.filter((k) => k !== largest && amounts[k] < MIN_DONATION_USD);
  return live
    .filter((k) => !small.includes(k))
    .map((k) => {
      const raw = amounts[k] + (k === largest ? small.reduce((s, x) => s + amounts[x], 0) : 0);
      const donation = Math.max(MIN_DONATION_USD, upToCent(raw));
      const fee = feeFor(donation, mode);
      return {
        key: `${k}${suffix}`,
        charity: k,
        harms: k === largest ? [k, ...small] : [k],
        donation,
        fee,
        total: Math.round((donation + fee) * 100) / 100,
        frequency,
      };
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

/** What a plan costs again each month or year, one gift per charity. */
export const repeatRows = (split: HarmSplit, billing: Billing, mode: PaymentMode = PAYMENT_MODE) =>
  payRows(split, billing, true, mode).filter((r) => r.frequency !== "ONCE");

export const sumTotal = (rows: PayRow[]) => Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100;

/** The card fees for giving these amounts to the charities one payment each, as Every.org charges them. */
export function perCharityFees(amounts: Partial<Record<ImpactKey, number>>): number {
  return Math.round(HARM_ORDER.reduce((s, k) => s + ((amounts[k] ?? 0) >= 0.005 ? cardFee(amounts[k]!) : 0), 0) * 100) / 100;
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
export function payLink(planId: string, row: PayRow, origin: string, mode: PaymentMode = PAYMENT_MODE): string | null {
  if (mode !== "every") return null; // No sponsor yet.
  const slug = EVERY_SLUGS[row.charity];
  if (!slug) return null;
  const back = (extra: string) => `${origin}/checkout/return?plan=${encodeURIComponent(planId)}${extra}`;
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
  lines: { productId: string; lifetime: boolean }[];
  /** Rows the person came back from Every.org on, with when. */
  done: Record<string, string>;
  /** Rows whose gift Every.org's webhook has confirmed. */
  confirmed: Record<string, true>;
  /** Set once covered items have been marked from this checkout. */
  applied?: boolean;
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
