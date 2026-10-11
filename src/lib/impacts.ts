import type { ImpactKey } from "./footprint";
import { usd } from "./pricing";

// How each kind of impact is named and shown.

export const IMPACT_INFO: Record<ImpactKey, { label: string; short: string; format: (n: number) => string }> = {
  carbon: {
    label: "Climate",
    short: "CO₂e",
    format: (kg) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)} t CO₂e` : `${kg < 10 ? kg.toFixed(2) : Math.round(kg)} kg CO₂e`),
  },
  air: {
    label: "Air pollution",
    short: "health damage",
    format: (n) => `${usd(n)} health damage`,
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
