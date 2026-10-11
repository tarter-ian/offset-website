import * as F from "./factors";
import { STATES, type StateCode } from "./data/states";

/**
 * Where a category's number came from. The offset adds a margin on top of the
 * estimate that shrinks as the source gets better, so nobody is under-offset.
 */
export type Confidence = "estimated" | "entered" | "measured";

export const MARGINS: Record<Confidence, number> = {
  estimated: 0.3, // questionnaire answer or regional average
  entered: 0.15, // amount typed in from a bill or statement
  measured: 0.05, // linked account or data export
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  estimated: "Estimated",
  entered: "From your bill",
  measured: "Measured",
};

/**
 * The four kinds of harm we track.
 * carbon: kg CO2e. air: dollars of health damage from air pollution.
 * water: liters of fresh water consumed, weighted by how scarce water is where it's used. land: square meters occupied for a year.
 */
export type ImpactKey = "carbon" | "air" | "water" | "land";
export type Impacts = Record<ImpactKey, number>;
export const IMPACT_KEYS: ImpactKey[] = ["carbon", "air", "water", "land"];

const zero = (): Impacts => ({ carbon: 0, air: 0, water: 0, land: 0 });
const scale = (i: Impacts, k: number): Impacts => ({
  carbon: i.carbon * k,
  air: i.air * k,
  water: i.water * k,
  land: i.land * k,
});
export const sumImpacts = (list: Impacts[]): Impacts =>
  list.reduce(
    (s, i) => ({ carbon: s.carbon + i.carbon, air: s.air + i.air, water: s.water + i.water, land: s.land + i.land }),
    zero(),
  );

export type HeatingFuel = "electric" | "gas" | "oil" | "propane" | "none";
export type CarType = "none" | "gas" | "hybrid" | "electric";
export type Diet = keyof typeof F.DIET_KG_PER_YEAR;
export type Shopping = keyof typeof F.SHOPPING_KG_PER_YEAR;

export interface Answers {
  scope: "individual" | "household";
  householdSize: number;
  state: StateCode;
  electricity: { mode: "average" | "bill" | "kwh"; amount?: number };
  heating: { fuel: HeatingFuel; mode: "average" | "bill"; billAmount?: number };
  /** Miles and trips are for the user alone, or the whole household, per `scope`. */
  car: { type: CarType; milesPerWeek: number; mpg?: number; chargedAtHome?: boolean };
  flights: { shortPerYear: number; longPerYear: number };
  /** Bus, train and subway miles a week. Optional for older saved answers. */
  transit?: { milesPerWeek: number };
  diet: Diet;
  shopping: Shopping;
  digital: {
    aiPromptsPerDay: number;
    aiMediaPerWeek: number;
    streamingHoursPerDay: number;
    /** Set when the prompt count came from a ChatGPT or Claude data export. */
    aiFromExport?: boolean;
    /** Average energy per prompt measured from an export, in Wh. */
    aiWhPerPrompt?: number;
    /** All-time energy measured from exports, in Wh. */
    aiPastWh?: number;
  };
}

export type CategoryKey =
  | "electricity"
  | "heating"
  | "car"
  | "flights"
  | "transit"
  | "meat"
  | "dairy"
  | "plants"
  | "clothing"
  | "electronics"
  | "household"
  | "services"
  | "ai"
  | "streaming";

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  electricity: "Electricity",
  heating: "Heating",
  car: "Car",
  flights: "Flights",
  transit: "Bus and train",
  meat: "Meat and fish",
  dairy: "Dairy and eggs",
  plants: "Plant foods",
  clothing: "Clothing",
  electronics: "Electronics",
  household: "Furniture and home goods",
  services: "Services and other",
  ai: "AI",
  streaming: "Video streaming",
};
export const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS) as CategoryKey[];

/** Areas group the subcategories people can cover. */
export type AreaKey = "home" | "travel" | "food" | "shopping" | "digital";
export const AREAS: { key: AreaKey; label: string; categories: CategoryKey[] }[] = [
  { key: "home", label: "Home", categories: ["electricity", "heating"] },
  { key: "travel", label: "Travel", categories: ["car", "flights", "transit"] },
  { key: "food", label: "Food", categories: ["meat", "dairy", "plants"] },
  { key: "shopping", label: "Shopping", categories: ["clothing", "electronics", "household", "services"] },
  { key: "digital", label: "Digital", categories: ["ai", "streaming"] },
];
export const areaOf = (k: CategoryKey) => AREAS.find((a) => a.categories.includes(k))!;

export interface CategoryResult {
  key: CategoryKey;
  label: string;
  /** Best estimate for one month. */
  impacts: Impacts;
  confidence: Confidence;
  margin: number;
  /** Estimate plus margin, the amount that gets offset. */
  offset: Impacts;
  note?: string;
  /** Impacts that apply to this category but we can't estimate yet. */
  notCounted: ImpactKey[];
}

export interface Footprint {
  categories: CategoryResult[];
  total: Impacts;
  offset: Impacts;
}

export const DEFAULT_ANSWERS: Answers = {
  scope: "individual",
  householdSize: 1,
  state: "CA",
  electricity: { mode: "average" },
  heating: { fuel: "gas", mode: "average" },
  car: { type: "gas", milesPerWeek: 200 },
  flights: { shortPerYear: 1, longPerYear: 0 },
  transit: { milesPerWeek: 0 },
  diet: "average",
  shopping: "average",
  digital: { aiPromptsPerDay: 10, aiMediaPerWeek: 0, streamingHoursPerDay: 2 },
};

const nonNeg = (n: number | undefined) => (Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0);

function category(
  key: CategoryKey,
  impacts: Partial<Impacts>,
  confidence: Confidence,
  note: string | undefined,
  notCounted: ImpactKey[] = [],
): CategoryResult {
  const full = { ...zero(), ...impacts };
  const any = IMPACT_KEYS.some((k) => full[k] > 0);
  const margin = any ? MARGINS[confidence] : 0;
  return {
    key,
    label: CATEGORY_LABELS[key],
    impacts: full,
    confidence,
    margin,
    offset: scale(full, 1 + margin),
    note,
    notCounted,
  };
}

export function gridKgPerKwh(state: StateCode): number {
  return (STATES[state].gridLbPerMwh * F.KG_PER_LB) / 1000;
}

const US_KG_PER_KWH = (F.US_GRID_LB_PER_MWH * F.KG_PER_LB) / 1000;
const US_NOX_LB_PER_MWH = 0.5;
const US_SO2_LB_PER_MWH = 0.359;

/**
 * Data center and network electricity for internet use. Carbon uses the IEA
 * streaming rate per kWh, since much of the internet runs outside the US;
 * water adds data center cooling.
 */
export function dataCenterImpacts(kwh: number): Impacts {
  const g = gridImpacts(kwh);
  return {
    ...g,
    carbon: kwh * (F.KG_PER_STREAMING_HOUR / F.STREAMING_KWH_PER_HOUR),
    water: g.water + kwh * F.DATACENTER_L_PER_KWH * F.scarcityWeight("datacenter"),
  };
}

/**
 * Everything behind AI use, from the energy to answer prompts (kWh): its share
 * of training, grid power and cooling water, the hardware and buildings, and
 * extra weight for data centers in dry areas or on their own gas power.
 */
export function aiImpacts(answerKwh: number): Impacts {
  const kwh = answerKwh / (1 - F.AI_TRAINING_SHARE);
  const g = gridImpacts(kwh);
  return {
    carbon: g.carbon / (1 - F.AI_HARDWARE_SHARE),
    air: g.air * F.AI_LOCAL_AIR_WEIGHT,
    water: g.water + kwh * F.DATACENTER_L_PER_KWH * F.scarcityWeight("datacenter"),
    land: 0,
  };
}

/** Health damage in dollars per kWh from power plant NOx and SO2. */
export function gridAirUsdPerKwh(noxLbPerMwh: number, so2LbPerMwh: number): number {
  return (
    ((noxLbPerMwh / F.LB_PER_SHORT_TON) * F.POWER_USD_PER_TON_NOX +
      (so2LbPerMwh / F.LB_PER_SHORT_TON) * F.POWER_USD_PER_TON_SO2) /
    1000
  );
}

/** Carbon, air and water for electricity drawn from a grid. */
export function gridImpacts(kwh: number, state?: StateCode): Impacts {
  const s = state ? STATES[state] : undefined;
  return {
    carbon: kwh * (state ? gridKgPerKwh(state) : US_KG_PER_KWH),
    air: kwh * gridAirUsdPerKwh(s?.noxLbPerMwh ?? US_NOX_LB_PER_MWH, s?.so2LbPerMwh ?? US_SO2_LB_PER_MWH),
    water: kwh * F.GRID_L_PER_KWH * F.scarcityWeight("grid"),
    land: 0,
  };
}

/** Health damage in dollars from ground-level NOx and PM2.5, in grams. */
function groundAirUsd(gNox: number, gPm25: number): number {
  return (gNox * F.GROUND_USD_PER_TON_NOX + gPm25 * F.GROUND_USD_PER_TON_PM25) / F.G_PER_SHORT_TON;
}

export function computeFootprint(a: Answers): Footprint {
  const state = STATES[a.state];
  const people = Math.max(1, Math.round(a.householdSize) || 1);
  // Home energy is billed per household; personal habits are per person.
  const homeShare = a.scope === "individual" ? 1 / people : 1;
  const personCount = a.scope === "household" ? people : 1;

  // Electricity
  let kwh: number;
  let elecConfidence: Confidence = "entered";
  if (a.electricity.mode === "kwh" && nonNeg(a.electricity.amount) > 0) {
    kwh = nonNeg(a.electricity.amount);
  } else if (a.electricity.mode === "bill" && nonNeg(a.electricity.amount) > 0) {
    kwh = nonNeg(a.electricity.amount) / (state.priceCentsPerKwh / 100);
  } else {
    kwh = state.avgKwhPerMonth;
    elecConfidence = "estimated";
  }
  const electricity = category(
    "electricity",
    scale(gridImpacts(kwh, a.state), homeShare),
    elecConfidence,
    `${Math.round(kwh)} kWh a month on the ${state.name} grid`,
  );

  // Heating
  const fuel = a.heating.fuel;
  const heat: Partial<Impacts> = {};
  let heatNote: string | undefined;
  const bill = a.heating.mode === "bill" ? nonNeg(a.heating.billAmount) : 0;
  if (fuel === "gas") {
    const therms = bill > 0 ? bill / F.GAS_PRICE_PER_THERM : F.AVG_THERMS_PER_MONTH;
    heat.carbon = therms * F.KG_CO2_PER_THERM_GAS;
    heat.air = groundAirUsd(therms * F.GAS_G_NOX_PER_THERM, therms * F.GAS_G_PM25_PER_THERM);
    heatNote = `${Math.round(therms)} therms of natural gas a month`;
  } else if (fuel === "oil") {
    const gal = bill > 0 ? bill / F.OIL_PRICE_PER_GAL : F.AVG_OIL_GAL_PER_MONTH;
    heat.carbon = gal * F.KG_CO2_PER_GAL_HEATING_OIL;
    heatNote = `${Math.round(gal)} gallons of heating oil a month`;
  } else if (fuel === "propane") {
    const gal = bill > 0 ? bill / F.PROPANE_PRICE_PER_GAL : F.AVG_PROPANE_GAL_PER_MONTH;
    heat.carbon = gal * F.KG_CO2_PER_GAL_PROPANE;
    heatNote = `${Math.round(gal)} gallons of propane a month`;
  } else if (fuel === "electric") {
    heatNote = "Included in home electricity";
  } else {
    heatNote = "No fuel heating";
  }
  const heating = category(
    "heating",
    scale({ ...zero(), ...heat }, homeShare),
    bill > 0 ? "entered" : "estimated",
    heatNote,
    fuel === "oil" || fuel === "propane" ? ["air"] : [],
  );

  // Car
  const milesPerMonth = nonNeg(a.car.milesPerWeek) * F.WEEKS_PER_MONTH;
  let car: CategoryResult;
  if (a.car.type === "gas" || a.car.type === "hybrid") {
    const mpg = nonNeg(a.car.mpg) || (a.car.type === "hybrid" ? 50 : F.DEFAULT_MPG);
    car = category(
      "car",
      {
        carbon: (milesPerMonth / mpg) * F.KG_CO2_PER_GAL_GASOLINE,
        air: groundAirUsd(milesPerMonth * F.CAR_G_NOX_PER_MILE, milesPerMonth * F.CAR_G_PM25_PER_MILE),
      },
      "estimated",
      `${Math.round(milesPerMonth)} miles a month at ${mpg} mpg`,
      ["water"],
    );
  } else if (a.car.type === "electric") {
    const homeBillCoversIt = a.car.chargedAtHome && a.electricity.mode !== "average";
    car = homeBillCoversIt
      ? category("car", {}, "estimated", "Charged at home, so already in your electricity bill")
      : category(
          "car",
          gridImpacts(milesPerMonth * F.EV_KWH_PER_MILE, a.state),
          "estimated",
          `${Math.round(milesPerMonth)} electric miles a month`,
        );
  } else {
    car = category("car", {}, "estimated", "No car");
  }

  // Flights
  const short = nonNeg(a.flights.shortPerYear);
  const long = nonNeg(a.flights.longPerYear);
  const flights = category(
    "flights",
    {
      carbon:
        ((short * F.KG_PER_SHORT_ROUND_TRIP + long * F.KG_PER_LONG_ROUND_TRIP) * F.FLIGHT_NON_CO2_MULTIPLIER) / 12,
    },
    "estimated",
    `${short} short and ${long} long round trips a year, spread over 12 months, including contrail effects`,
    ["air", "water"],
  );

  const transitMiles = nonNeg(a.transit?.milesPerWeek) * F.WEEKS_PER_MONTH;
  const transit = category(
    "transit",
    { carbon: transitMiles * F.TRANSIT_KG_PER_MILE },
    "estimated",
    `${Math.round(transitMiles)} miles a month`,
    ["air", "water"],
  );

  // Food, split from the diet total by food group (approximate shares).
  const foodTotal: Impacts = {
    carbon: (F.DIET_KG_PER_YEAR[a.diet] / 12) * personCount,
    air: 0,
    water: F.DIET_L_PER_DAY[a.diet] * F.DAYS_PER_MONTH * F.scarcityWeight("food") * personCount,
    land: (F.DIET_M2_PER_YEAR[a.diet] / 12) * personCount,
  };
  const shares = F.FOOD_SHARES[a.diet];
  const food = (["meat", "dairy", "plants"] as const).map((k) =>
    category(k, scale(foodTotal, shares[k]), "estimated", undefined, ["air"]),
  );

  // Goods and services, split by typical spending shares.
  const shopTotal = (F.SHOPPING_KG_PER_YEAR[a.shopping] / 12) * personCount;
  const shopping = (["clothing", "electronics", "household", "services"] as const).map((k) =>
    category(k, { carbon: shopTotal * F.SHOPPING_SHARES[k] }, "estimated", undefined, ["air", "water", "land"]),
  );

  // AI: grid power plus on-site data center cooling water.
  const d = a.digital;
  const aiFor = (kwh: number): Impacts => scale(aiImpacts(kwh), personCount);
  const prompts = nonNeg(d.aiPromptsPerDay) * F.DAYS_PER_MONTH;
  const media = nonNeg(d.aiMediaPerWeek) * F.WEEKS_PER_MONTH;
  const ai = category(
    "ai",
    aiFor((prompts * (d.aiWhPerPrompt ?? F.WH_PER_AI_PROMPT) + media * F.WH_PER_AI_MEDIA) / 1000),
    d.aiFromExport ? "measured" : "estimated",
    `About ${Math.round(prompts)} prompts${media ? ` and ${Math.round(media)} images or videos` : ""} a month${
      d.aiFromExport ? ", prompts from your data export" : ""
    }`,
  );

  const streamHours = nonNeg(d.streamingHoursPerDay) * F.DAYS_PER_MONTH;
  const streaming = category(
    "streaming",
    scale(dataCenterImpacts(streamHours * F.STREAMING_KWH_PER_HOUR), personCount),
    "estimated",
    `${Math.round(streamHours)} hours a month, data centers and networks only`,
  );

  const categories = [electricity, heating, car, flights, transit, ...food, ...shopping, ai, streaming];
  return {
    categories,
    total: sumImpacts(categories.map((c) => c.impacts)),
    offset: sumImpacts(categories.map((c) => c.offset)),
  };
}
