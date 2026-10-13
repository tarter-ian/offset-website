import type { ImpactKey, Impacts } from "./footprint";
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

/** Healthy life lost to air pollution damage (dollars), e.g. "3.9 min", kept for the (i) details and question pages. */
export const lifeText = (usdDamage: number) => lifeLost(usdDamage * MINUTES_OF_LIFE_PER_DAMAGE_USD);

const num = (x: number) => (x < 10 ? x.toFixed(1).replace(/\.0$/, "") : Math.round(x).toLocaleString("en-US"));

/**
 * The air row (Ian, 2026-10-13): liters of smog gases released, e.g. "52 L smog", or
 * grams of soot where there's next to no gas (making clothes and electronics).
 */
export function airAmount(i: Pick<Impacts, "smogL" | "sootG">): string {
  if (i.smogL >= 0.05 || i.sootG < 0.05) return `${i.smogL >= 10_000 ? `${num(i.smogL / 1000)} m³` : `${num(i.smogL)} L`} smog`;
  return `${i.sootG >= 1000 ? `${num(i.sootG / 1000)} kg` : `${num(i.sootG)} g`} soot`;
}

/** Air on tiles and the receipt, e.g. "52 L smog"; healthy life lost is in each item's (i). */
export const airShort = airAmount;

/** How each harm reads. `format` takes the harm's amount, and the air row also reads smog and soot from `i`. */
export const IMPACT_INFO: Record<ImpactKey, { label: string; short: string; format: (n: number, i: Pick<Impacts, "smogL" | "sootG">) => string }> = {
  carbon: {
    label: "Climate",
    short: "CO₂e",
    format: (kg) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)} t CO₂e` : `${kg < 10 ? kg.toFixed(2) : Math.round(kg)} kg CO₂e`),
  },
  air: {
    label: "Air pollution",
    short: "smog",
    format: (_usdDamage, i) => airAmount(i),
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
