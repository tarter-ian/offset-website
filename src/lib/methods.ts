import * as F from "./factors";
import { IMPACT_KEYS, type ImpactKey, type Impacts } from "./footprint";
import { impactCost } from "./pricing";
import { CHARITIES, type Charity } from "./charities";
import type { Product } from "./store";

// Plain-language notes on how each item is estimated, for the (i) on its tile.
// The method page has the full sources.

const g = (kg: number) => `${Math.round(kg * 1000)} g`;

const ONLINE_NOTE =
  "Hours a day times the energy of the data centers and networks behind it, on the US grid, plus the water to cool them. Your own device's power is counted under Devices. These figures are rough, so we add a wider margin.";

const DEVICE_NOTE = (id: keyof typeof F.DEVICES) => {
  const d = F.DEVICES[id];
  return [
    `Making one takes about ${d.kgToMake} kg of CO₂e, and we assume you replace it every ${d.yearsKept} years.`,
    `Running it uses about ${d.kwhPerYear} kWh a year on the US grid.`,
    "Mining and manufacturing also use water and land, which we count from a study of smartphones scaled by the carbon to make each device.",
    `Lifetime covers every one you'll go through until age ${F.LIFETIME_TO_AGE}.`,
  ];
};

const FOOD_NOTE = (what: string) => [
  `Yearly per-person carbon, water and land for your type of diet, with ${what} taking its typical share.`,
  "Air pollution is your share of the farm pollution deaths in the US each year, mostly from ammonia off manure and fertilizer, scaled by your diet.",
];

const SHOPPING_NOTE = (what: string, share: number) => [
  `A yearly per-person carbon figure for your level of spending, with ${what} taking about ${Math.round(share * 100)}% of it.`,
];

export const HOW_ESTIMATED: Record<string, string[]> = {
  ai: [
    `About ${F.WH_PER_AI_PROMPT} Wh a prompt, or each prompt measured from your ChatGPT, Claude or Gemini export if you link it.`,
    `Adds each prompt's share of training the models (${Math.round(F.AI_TRAINING_SHARE * 100)}% of AI energy) and of making the chips and buildings (+${Math.round(F.AI_HARDWARE_SHARE * 100)}% carbon).`,
    "Power is on the US grid; water is the power plants' plus data center cooling.",
    `Lifetime assumes use until age ${F.LIFETIME_TO_AGE} and allows for it to grow.`,
  ],
  "ai-media": [`About ${F.WH_PER_AI_MEDIA} Wh per picture or short clip, with the same training, hardware and water as chat.`],
  video: [`About ${F.STREAMING_KWH_PER_HOUR} kWh and ${g(F.KG_PER_STREAMING_HOUR)} of CO₂ an hour, from the IEA.`, ONLINE_NOTE],
  social: [ONLINE_NOTE],
  gaming: [ONLINE_NOTE],
  calls: [ONLINE_NOTE],
  music: [ONLINE_NOTE],
  browsing: [ONLINE_NOTE],
  phone: DEVICE_NOTE("phone"),
  laptop: DEVICE_NOTE("laptop"),
  tablet: DEVICE_NOTE("tablet"),
  desktop: DEVICE_NOTE("desktop"),
  tv: DEVICE_NOTE("tv"),
  console: DEVICE_NOTE("console"),
  electricity: [
    "Your bill, or your state's average home if you haven't linked one.",
    "Times your state's grid rates for greenhouse gases, NOx, SO₂ and the water power plants consume.",
  ],
  heating: [
    `Your gas bill divided by about $${F.GAS_PRICE_PER_THERM} a therm, at ${F.KG_CO2_PER_THERM_GAS} kg CO₂ a therm.`,
    "Plus the NOx and fine particles from burning it at home.",
  ],
  car: [
    `Miles divided by ${F.DEFAULT_MPG} mpg, at ${F.KG_CO2_PER_GAL_GASOLINE} kg CO₂ a gallon.`,
    "Plus tailpipe NOx and particles, and about 1.5 gallons of water used to refine each gallon of gas.",
  ],
  flights: [
    `About ${F.KG_PER_SHORT_ROUND_TRIP} kg CO₂ a round trip, times ${F.FLIGHT_NON_CO2_MULTIPLIER} for contrails and other high-altitude warming.`,
    `Air pollution is your fuel's share of about ${F.FLIGHT_AIR_DEATHS_PER_YEAR.toLocaleString("en-US")} deaths a year from aviation worldwide.`,
    "Water is what it takes to refine the fuel.",
  ],
  transit: [
    `About ${F.TRANSIT_KG_PER_MILE} kg CO₂e a passenger-mile.`,
    "Air pollution and water are assumed to match a car's per kilogram of CO₂, a rough figure.",
  ],
  meat: FOOD_NOTE("meat and fish"),
  dairy: FOOD_NOTE("dairy and eggs"),
  plants: FOOD_NOTE("plant foods"),
  clothing: [...SHOPPING_NOTE("clothing", F.SHOPPING_SHARES.clothing), "Water, land and air pollution aren't counted yet."],
  electronics: [
    ...SHOPPING_NOTE("electronics", F.SHOPPING_SHARES.electronics),
    "Water and land to mine and make them are scaled from a study of smartphones.",
  ],
  household: [...SHOPPING_NOTE("home goods", F.SHOPPING_SHARES.household), "Water, land and air pollution aren't counted yet."],
  services: [...SHOPPING_NOTE("services", F.SHOPPING_SHARES.services), "Water, land and air pollution aren't counted yet."],
};

export const howEstimated = (p: Product): string[] => HOW_ESTIMATED[p.id] ?? [];

/** Who gets an item's donation, and each charity's share of it. */
export function whereItGoes(i: Impacts): { key: ImpactKey; charity: Charity; share: number }[] {
  const c = impactCost(i);
  const total = IMPACT_KEYS.reduce((s, k) => s + c[k], 0);
  if (total <= 0) return [];
  return IMPACT_KEYS.filter((k) => c[k] / total >= 0.005)
    .map((k) => ({ key: k, charity: CHARITIES[k], share: c[k] / total }))
    .sort((a, b) => b.share - a.share);
}
