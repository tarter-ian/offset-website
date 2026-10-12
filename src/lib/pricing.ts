import { M2_PER_ACRE } from "./factors";
import { IMPACT_KEYS, sumImpacts, type CategoryKey, type Footprint, type ImpactKey, type Impacts } from "./footprint";

// Placeholder prices, to set before launch.

/**
 * Carbon: how a tonne is covered. Policy charities are cheap per expected tonne
 * but can't be measured (Founders Pledge puts its top picks under $10/t);
 * certified removal (Puro biochar, ~EUR 159/t) is measured but costly. The
 * blend is 90% policy at a conservative $10/t plus 10% removal at ~$400/t.
 */
export type CarbonMode = "expected" | "blend" | "verified";
export const CARBON_MODES: Record<CarbonMode, { label: string; perTonne: number; detail: string }> = {
  expected: { label: "Expected impact", perTonne: 15, detail: "All to policy charities. Cheapest, but no tonne is measured." },
  blend: { label: "Blend", perTonne: 49, detail: "90% policy charities, 10% measured carbon removal." },
  verified: { label: "Verified only", perTonne: 185, detail: "Certified carbon removal. Every tonne is measured." },
};
export const DEFAULT_CARBON_MODE: CarbonMode = "expected";
/** Share of the climate donation that goes to policy charities; the rest buys removal. */
export const CARBON_POLICY_SHARE: Record<CarbonMode, number> = { expected: 1, blend: 9 / 49, verified: 0 };
export const DONATION_PER_TONNE_USD = CARBON_MODES[DEFAULT_CARBON_MODE].perTonne;

/** Air: share of the estimated health damage donated to clean-air work. */
export const AIR_DAMAGE_SHARE = 0.1;

/**
 * Water: how a (scarcity-weighted) gallon is covered. Expected impact funds paid
 * water-saving work in dry regions, like farm irrigation upgrades, which has
 * cost roughly $70 to $500 an acre-foot; we use about $400 ($1.25 per 1,000
 * gallons). Verified buys Bonneville Environmental Foundation Water Restoration
 * Certificates, $4 per 1,000 gallons returned to a river (ClimeCo listing).
 */
export type WaterMode = "expected" | "verified";
export const WATER_MODES: Record<WaterMode, { label: string; per1000Gal: number; detail: string }> = {
  expected: {
    label: "Expected impact",
    per1000Gal: 1.25,
    detail: "Funds water-saving projects in dry regions. Cheapest, but the savings are estimated.",
  },
  verified: {
    label: "1:1 restoration",
    per1000Gal: 4,
    detail: "Certified restoration. Every gallon is returned to a stressed river.",
  },
};
export const DEFAULT_WATER_MODE: WaterMode = "expected";
const LITERS_PER_1000_GAL = 3785.41;

/** Nature: protect an area equal to the land used that month. Rainforest Trust
 * says protecting an acre of rainforest costs about $10. */
export const LAND_USD_PER_M2 = 10 / M2_PER_ACRE;

/**
 * E-waste: pay for every kilogram of the electronics you'll throw away to be
 * reused or recycled properly. Nonprofit refurbishers spend about $8 to $14 per
 * kg they handle (total spending over pounds reported: PCs for People 2024
 * ~$8.50, Free Geek FY25 ~$9.40, Human-I-T 2025 ~$14). That overstates one more
 * kg, since it includes internet and skills programs and ignores device sales,
 * so we take the low end. Only about a fifth of the world's e-waste is recycled
 * properly (Global E-waste Monitor 2024). Approximate.
 */
export const EWASTE_USD_PER_KG = 8;

const cents = (n: number) => Math.round(n * 100) / 100;

/**
 * We make no profit on fees (Ian, 2026-10-12). Card payments go through
 * Every.org at 30¢ + 2.2%. With a fiscal sponsor ("sponsor" mode), each payment
 * also carries the sponsor's share, 6.5–8%; we show 8% until an agreement is
 * signed. Paying through Every.org directly ("every" mode, for now) has no
 * sponsor, so its rate is 0 and each charity is paid separately, with its own
 * card fee. Fees are worked out on the whole payment, so the donation arrives in full.
 */
export type PaymentMode = "every" | "sponsor";
export const CARD_FIXED_USD = 0.3;
export const CARD_RATE = 0.022;
export const SPONSOR_RATE = 0.08;
/** The sponsor's share in each payment mode: none when paying through Every.org directly. */
export const sponsorRate = (mode: PaymentMode) => (mode === "every" ? 0 : SPONSOR_RATE);
export const paymentFee = (donation: number, sponsor: number = SPONSOR_RATE) =>
  donation > 0 ? Math.ceil(((CARD_FIXED_USD + (CARD_RATE + sponsor) * donation) / (1 - CARD_RATE - sponsor)) * 100) / 100 : 0;
/** The card fee alone on one payment, as on each Every.org donation. */
export const cardFee = (donation: number) => paymentFee(donation, 0);
/** The fee split into what the card processor and the sponsor each take. */
export function feeParts(donation: number): { card: number; sponsor: number } {
  const fee = paymentFee(donation);
  const sponsor = Math.round(SPONSOR_RATE * (donation + fee) * 100) / 100;
  return { card: Math.round((fee - sponsor) * 100) / 100, sponsor };
}
/** "30¢ + 2.2%" and "8%", for labels. */
export const CARD_FEE_LABEL = `30¢ + ${Math.round(CARD_RATE * 1000) / 10}%`;
export const SPONSOR_FEE_LABEL = `${Math.round(SPONSOR_RATE * 1000) / 10}%`;

/**
 * Smallest donation, a dollar on any payment. Small donations are pooled and
 * each charity gets one payment a month, so they still arrive in full (Ian, 2026-10-12).
 */
export const MIN_DONATION_USD = 1;

/** Ongoing offsets can be billed yearly: one approval and one 30¢ card charge a year instead of twelve. */
export type Billing = "annual" | "monthly";
/** Monthly by default: most consumers prefer it because it is easier to budget and cancel. Yearly is the discounted option. */
export const DEFAULT_BILLING: Billing = "monthly";
export const ANNUAL_MIN_DONATION_USD = MIN_DONATION_USD;
export const BILLING: Record<Billing, { label: string; per: string; approve: string }> = {
  annual: { label: "Yearly", per: "a year", approve: "once a year" },
  monthly: { label: "Monthly", per: "a month", approve: "each month" },
};

export interface Recurring {
  donation: number;
  fee: number;
  total: number;
  minimumApplied: boolean;
}

/** Turns a month's donation into what's charged each billing period, with that payment's card fee. */
export function recurringPrice(rawMonthlyDonation: number, billing: Billing): Recurring {
  if (billing === "monthly") {
    const donation = Math.max(MIN_DONATION_USD, Math.ceil(rawMonthlyDonation * 100) / 100);
    const fee = paymentFee(donation);
    return { donation, fee, total: cents(donation + fee), minimumApplied: rawMonthlyDonation < MIN_DONATION_USD };
  }
  const raw = rawMonthlyDonation * 12;
  const donation = Math.max(ANNUAL_MIN_DONATION_USD, Math.ceil(raw));
  const fee = paymentFee(donation);
  return { donation, fee, total: cents(donation + fee), minimumApplied: raw < ANNUAL_MIN_DONATION_USD };
}

export interface MonthlyCost {
  /** Donation for each kind of impact, before the minimum. */
  byImpact: Impacts;
  donation: number;
  fee: number;
  total: number;
  minimumApplied: boolean;
}

export function impactCost(
  i: Impacts,
  carbonMode: CarbonMode = DEFAULT_CARBON_MODE,
  waterMode: WaterMode = DEFAULT_WATER_MODE,
): Impacts {
  return {
    carbon: (i.carbon / 1000) * CARBON_MODES[carbonMode].perTonne,
    air: i.air * AIR_DAMAGE_SHARE,
    water: (i.water / LITERS_PER_1000_GAL) * WATER_MODES[waterMode].per1000Gal,
    land: i.land * LAND_USD_PER_M2,
    ewaste: i.ewaste * EWASTE_USD_PER_KG,
  };
}

export function monthlyCost(
  footprint: Footprint,
  covered: CategoryKey[],
  impacts: ImpactKey[] = IMPACT_KEYS,
  carbonMode: CarbonMode = DEFAULT_CARBON_MODE,
  waterMode: WaterMode = DEFAULT_WATER_MODE,
): MonthlyCost {
  const chosen = footprint.categories.filter((c) => covered.includes(c.key));
  const all = impactCost(sumImpacts(chosen.map((c) => c.offset)), carbonMode, waterMode);
  const byImpact: Impacts = { carbon: 0, air: 0, water: 0, land: 0, ewaste: 0 };
  for (const k of impacts) byImpact[k] = all[k];
  const raw = byImpact.carbon + byImpact.air + byImpact.water + byImpact.land + byImpact.ewaste;
  const active = chosen.length > 0 && impacts.length > 0;
  const minimumApplied = active && raw < MIN_DONATION_USD;
  const donation = active ? cents(Math.max(raw, MIN_DONATION_USD)) : 0;
  const fee = paymentFee(donation);
  return { byImpact, donation, fee, total: cents(donation + fee), minimumApplied };
}

export const usd = (n: number) =>
  n > 0 && n < 0.005 ? "under 1¢" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// One-time "for life" option for plans that cost under the monthly minimum.
// Covers this many years of today's use, times a buffer in case use grows.
export const LIFETIME_YEARS = 30;
/**
 * Future AI use counts 1.5 times over (Ian, 2026-10-11). Energy per prompt is
 * falling fast (Google measured a 33x drop in a year) while use keeps rising,
 * so a person's AI footprint could go either way; 1.5x stays cautious.
 */
export const LIFETIME_GROWTH_BUFFER = 1.5;
export const LIFETIME_MIN_DONATION_USD = MIN_DONATION_USD;

export interface LifetimeCost {
  donation: number;
  fee: number;
  total: number;
}

/** Offered only when the monthly donation would be raised to the minimum. */
export function lifetimeCost(monthly: MonthlyCost): LifetimeCost | null {
  if (!monthly.minimumApplied) return null;
  const raw = monthly.byImpact.carbon + monthly.byImpact.air + monthly.byImpact.water + monthly.byImpact.land + monthly.byImpact.ewaste;
  const donation = Math.max(LIFETIME_MIN_DONATION_USD, Math.ceil(raw * 12 * LIFETIME_YEARS * LIFETIME_GROWTH_BUFFER));
  const fee = paymentFee(donation);
  return { donation, fee, total: cents(donation + fee) };
}
