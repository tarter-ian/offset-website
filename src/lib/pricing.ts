import { M2_PER_ACRE } from "./factors";
import { sumImpacts, type CategoryKey, type Footprint, type Impacts } from "./footprint";

// Placeholder prices, to set before launch.

/** Carbon: donation per tonne of CO2e. Founders Pledge estimates its top climate
 * charities avert a tonne for under $10 in expectation. */
export const DONATION_PER_TONNE_USD = 15;

/** Air: share of the estimated health damage donated to clean-air work. */
export const AIR_DAMAGE_SHARE = 0.1;

/** Water: Bonneville Environmental Foundation Water Restoration Certificates,
 * $4 per 1,000 gallons restored (ClimeCo listing). */
export const WATER_USD_PER_LITER = 4 / 3785.41;

/** Nature: protect an area equal to the land used that month. Rainforest Trust
 * says protecting an acre of rainforest costs about $10. */
export const LAND_USD_PER_M2 = 10 / M2_PER_ACRE;

/** Fee: $1 for each category covered, capped. */
export const FEE_PER_CATEGORY_USD = 1;
export const MAX_FEE_USD = 4;

/** Smallest donation we pass on, so tiny plans still reach the charities. */
export const MIN_DONATION_USD = 1;

export interface MonthlyCost {
  /** Donation for each kind of impact, before the minimum. */
  byImpact: Impacts;
  donation: number;
  fee: number;
  total: number;
  minimumApplied: boolean;
}

const cents = (n: number) => Math.round(n * 100) / 100;

export function impactCost(i: Impacts): Impacts {
  return {
    carbon: (i.carbon / 1000) * DONATION_PER_TONNE_USD,
    air: i.air * AIR_DAMAGE_SHARE,
    water: i.water * WATER_USD_PER_LITER,
    land: i.land * LAND_USD_PER_M2,
  };
}

export function monthlyCost(footprint: Footprint, covered: CategoryKey[]): MonthlyCost {
  const chosen = footprint.categories.filter((c) => covered.includes(c.key));
  const byImpact = impactCost(sumImpacts(chosen.map((c) => c.offset)));
  const raw = byImpact.carbon + byImpact.air + byImpact.water + byImpact.land;
  const minimumApplied = chosen.length > 0 && raw < MIN_DONATION_USD;
  const donation = chosen.length ? cents(Math.max(raw, MIN_DONATION_USD)) : 0;
  const fee = Math.min(MAX_FEE_USD, chosen.length * FEE_PER_CATEGORY_USD);
  return { byImpact, donation, fee, total: cents(donation + fee), minimumApplied };
}

export const usd = (n: number) =>
  n > 0 && n < 0.005 ? "under 1¢" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

// One-time "for life" option for plans that cost under the monthly minimum.
// Covers this many years of today's use, times a buffer in case use grows.
export const LIFETIME_YEARS = 30;
export const LIFETIME_GROWTH_BUFFER = 3;
export const LIFETIME_MIN_DONATION_USD = 5;
export const LIFETIME_FEE_USD = 3;

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
