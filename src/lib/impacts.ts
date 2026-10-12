import type { ImpactKey } from "./footprint";
import { MINUTES_OF_LIFE_PER_DAMAGE_USD } from "./factors";

// How each kind of impact is named and shown.

/** Minutes of life, in the largest short unit that keeps a readable number. */
function lifeLost(min: number): string {
  const n = (x: number) => (x < 10 ? x.toFixed(1).replace(/\.0$/, "") : String(Math.round(x)));
  if (min < 1) return `${Math.round(min * 60)} sec`;
  if (min < 90) return `${n(min)} min`;
  if (min < 48 * 60) return `${n(min / 60)} hr`;
  return `${n(min / 60 / 24)} days`;
}

export const IMPACT_INFO: Record<ImpactKey, { label: string; short: string; format: (n: number) => string }> = {
  carbon: {
    label: "Climate",
    short: "CO₂e",
    format: (kg) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)} t CO₂e` : `${kg < 10 ? kg.toFixed(2) : Math.round(kg)} kg CO₂e`),
  },
  air: {
    label: "Air pollution",
    short: "life lost",
    format: (usdDamage) => `${lifeLost(usdDamage * MINUTES_OF_LIFE_PER_DAMAGE_USD)} of life`,
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
};
