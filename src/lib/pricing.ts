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

const cents = (n: number) => Math.round(n * 100) / 100;

/** Fee: a flat $2 a month for a monthly plan, however many things it covers. */
export const MONTHLY_FEE_USD = 2;

/** Smallest donation we pass on, so tiny plans still reach the charities. */
export const MIN_DONATION_USD = 1;

/**
 * Ongoing offsets are billed yearly by default: one approval a year, and card
 * fees take far less of one larger payment. Paying yearly gets two months of
 * our fee free. Monthly billing stays available.
 */
export type Billing = "annual" | "monthly";
/** Monthly by default: most consumers prefer it because it is easier to budget and cancel. Yearly is the discounted option. */
export const DEFAULT_BILLING: Billing = "monthly";
export const ANNUAL_FEE_MONTHS = 10;
export const ANNUAL_MIN_DONATION_USD = 5;
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

/** Turns a month's donation and fee into what's charged each billing period. */
export function recurringPrice(rawMonthlyDonation: number, monthlyFee: number, billing: Billing): Recurring {
  if (billing === "monthly") {
    const donation = Math.max(MIN_DONATION_USD, Math.ceil(rawMonthlyDonation * 100) / 100);
    return { donation, fee: monthlyFee, total: cents(donation + monthlyFee), minimumApplied: rawMonthlyDonation < MIN_DONATION_USD };
  }
  const raw = rawMonthlyDonation * 12;
  const donation = Math.max(ANNUAL_MIN_DONATION_USD, Math.ceil(raw));
  const fee = monthlyFee * ANNUAL_FEE_MONTHS;
  return { donation, fee, total: donation + fee, minimumApplied: raw < ANNUAL_MIN_DONATION_USD };
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
  const byImpact: Impacts = { carbon: 0, air: 0, water: 0, land: 0 };
  for (const k of impacts) byImpact[k] = all[k];
  const raw = byImpact.carbon + byImpact.air + byImpact.water + byImpact.land;
  const active = chosen.length > 0 && impacts.length > 0;
  const minimumApplied = active && raw < MIN_DONATION_USD;
  const donation = active ? cents(Math.max(raw, MIN_DONATION_USD)) : 0;
  const fee = active ? MONTHLY_FEE_USD : 0;
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
export const LIFETIME_MIN_DONATION_USD = 5;
/**
 * $3 on a one-time payment. Waived for anyone already paying the monthly fee,
 * and on every one-time payment after someone's first.
 */
export const LIFETIME_FEE_USD = 3;
export const oneTimeFee = (opts: { hasMonthly?: boolean; returning?: boolean } = {}) =>
  opts.hasMonthly || opts.returning ? 0 : LIFETIME_FEE_USD;

export interface LifetimeCost {
  donation: number;
  fee: number;
  total: number;
}

/** Offered only when the monthly donation would be raised to the minimum. */
export function lifetimeCost(monthly: MonthlyCost): LifetimeCost | null {
  if (!monthly.minimumApplied) return null;
  const raw = monthly.byImpact.carbon + monthly.byImpact.air + monthly.byImpact.water + monthly.byImpact.land;
  const donation = Math.max(LIFETIME_MIN_DONATION_USD, Math.ceil(raw * 12 * LIFETIME_YEARS * LIFETIME_GROWTH_BUFFER));
  return { donation, fee: LIFETIME_FEE_USD, total: donation + LIFETIME_FEE_USD };
}
