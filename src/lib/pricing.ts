import { M2_PER_ACRE } from "./factors";
import { AREAS, IMPACT_KEYS, sumImpacts, type CategoryKey, type Footprint, type ImpactKey, type Impacts } from "./footprint";

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

/** Water: Bonneville Environmental Foundation Water Restoration Certificates,
 * $4 per 1,000 gallons restored (ClimeCo listing). */
export const WATER_USD_PER_LITER = 4 / 3785.41;

/** Nature: protect an area equal to the land used that month. Rainforest Trust
 * says protecting an acre of rainforest costs about $10. */
export const LAND_USD_PER_M2 = 10 / M2_PER_ACRE;

/** Fee: $1 for each area (home, travel, ...) with anything covered, capped. */
export const FEE_PER_AREA_USD = 1;
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

export function impactCost(i: Impacts, carbonMode: CarbonMode = DEFAULT_CARBON_MODE): Impacts {
  return {
    carbon: (i.carbon / 1000) * CARBON_MODES[carbonMode].perTonne,
    air: i.air * AIR_DAMAGE_SHARE,
    water: i.water * WATER_USD_PER_LITER,
    land: i.land * LAND_USD_PER_M2,
  };
}

export function monthlyCost(
  footprint: Footprint,
  covered: CategoryKey[],
  impacts: ImpactKey[] = IMPACT_KEYS,
  carbonMode: CarbonMode = DEFAULT_CARBON_MODE,
): MonthlyCost {
  const chosen = footprint.categories.filter((c) => covered.includes(c.key));
  const all = impactCost(sumImpacts(chosen.map((c) => c.offset)), carbonMode);
  const byImpact: Impacts = { carbon: 0, air: 0, water: 0, land: 0 };
  for (const k of impacts) byImpact[k] = all[k];
  const raw = byImpact.carbon + byImpact.air + byImpact.water + byImpact.land;
  const active = chosen.length > 0 && impacts.length > 0;
  const minimumApplied = active && raw < MIN_DONATION_USD;
  const donation = active ? cents(Math.max(raw, MIN_DONATION_USD)) : 0;
  const areas = active ? AREAS.filter((a) => a.categories.some((k) => covered.includes(k))).length : 0;
  const fee = Math.min(MAX_FEE_USD, areas * FEE_PER_AREA_USD);
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
