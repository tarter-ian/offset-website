import type { ImpactKey } from "./footprint";
import { MINUTES_OF_LIFE_PER_DAMAGE_USD, SOOT_EQ_G_PER_DAMAGE_USD } from "./factors";

// How each kind of impact is named and shown.

/** Minutes of life, in the largest short unit that keeps a readable number. */
function lifeLost(min: number): string {
  const n = (x: number) => (x < 10 ? x.toFixed(1).replace(/\.0$/, "") : String(Math.round(x)));
  if (min < 1) return `${Math.round(min * 60)} sec`;
  if (min < 90) return `${n(min)} min`;
  if (min < 48 * 60) return `${n(min / 60)} hr`;
  return `${n(min / 60 / 24)} days`;
}

/** Healthy life lost to air pollution damage (dollars), e.g. "3.9 min", kept for the (i) details and question pages. */
export const lifeText = (usdDamage: number) => lifeLost(usdDamage * MINUTES_OF_LIFE_PER_DAMAGE_USD);

/** Grams of soot-equivalent for air pollution damage (dollars), e.g. "11 g". */
export function sootGrams(usdDamage: number): string {
  const g = usdDamage * SOOT_EQ_G_PER_DAMAGE_USD;
  if (g >= 1000) return `${(g / 1000).toFixed(g < 10_000 ? 1 : 0)} kg`;
  return `${g < 10 ? g.toFixed(1).replace(/\.0$/, "") : Math.round(g)} g`;
}

/** Air pollution on tiles and the receipt, e.g. "11 g"; minutes of healthy life are in each item's (i). */
export const airShort = sootGrams;

export const IMPACT_INFO: Record<ImpactKey, { label: string; short: string; format: (n: number) => string }> = {
  carbon: {
    label: "Climate",
    short: "CO₂e",
    format: (kg) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)} t CO₂e` : `${kg < 10 ? kg.toFixed(2) : Math.round(kg)} kg CO₂e`),
  },
  air: {
    label: "Air pollution",
    short: "soot",
    format: (usdDamage) => `${sootGrams(usdDamage)} soot`,
  },
  water: {
    label: "Water",
    short: "water",
    format: (l) => `${l < 10 ? l.toFixed(1) : Math.round(l).toLocaleString("en-US")} L water`,
  },
  land: {
    label: "Nature",
    short: "land",
    format: (m2) =>
      m2 >= 10 ? `${Math.round(m2).toLocaleString("en-US")} m² land` : m2 >= 0.1 ? `${m2.toFixed(1)} m² land` : "under 0.1 m² land",
  },
  ewaste: {
    label: "E-waste",
    short: "e-waste",
    format: (kg) => `${kg >= 10 ? Math.round(kg).toLocaleString("en-US") : kg >= 0.1 ? kg.toFixed(1) : "under 0.1"} kg e-waste`,
  },
};
