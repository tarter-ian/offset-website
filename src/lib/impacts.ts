import type { ImpactKey } from "./footprint";
import { MINUTES_OF_LIFE_PER_DAMAGE_USD } from "./factors";

// How each kind of impact is named and shown.

/** Minutes of life, in the largest unit that keeps a readable number. */
function lifeLost(min: number): string {
  const n = (x: number, unit: string) => `${x < 10 ? x.toFixed(1).replace(/\.0$/, "") : Math.round(x)} ${unit}${x === 1 ? "" : "s"}`;
  if (min < 1) return `${Math.round(min * 60)} seconds`;
  if (min < 90) return n(min, "minute");
  if (min < 48 * 60) return n(min / 60, "hour");
  return n(min / 60 / 24, "day");
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
    format: (usdDamage) => `${lifeLost(usdDamage * MINUTES_OF_LIFE_PER_DAMAGE_USD)} of healthy life lost`,
  },
  water: {
    label: "Water",
    short: "water",
    format: (l) => `${l < 10 ? l.toFixed(1) : Math.round(l).toLocaleString("en-US")} L water`,
  },
  land: {
    label: "Nature",
    short: "land",
    format: (m2) => `${Math.round(m2).toLocaleString("en-US")} m² land`,
  },
};
