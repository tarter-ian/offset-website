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
  measured: 0.05, // linked account (step 2)
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  estimated: "Estimated",
  entered: "From your bill",
  measured: "Measured",
};

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
  diet: Diet;
  shopping: Shopping;
  digital: { aiPromptsPerDay: number; aiMediaPerWeek: number; streamingHoursPerDay: number };
}

export type CategoryKey = "electricity" | "heating" | "car" | "flights" | "food" | "shopping" | "digital";

export interface CategoryResult {
  key: CategoryKey;
  label: string;
  /** Best estimate, kg CO2e per month. */
  kg: number;
  confidence: Confidence;
  margin: number;
  /** Estimate plus margin, the amount that gets offset. */
  offsetKg: number;
  note?: string;
}

export interface Footprint {
  categories: CategoryResult[];
  totalKg: number;
  offsetKg: number;
}

export const DEFAULT_ANSWERS: Answers = {
  scope: "individual",
  householdSize: 1,
  state: "CA",
  electricity: { mode: "average" },
  heating: { fuel: "gas", mode: "average" },
  car: { type: "gas", milesPerWeek: 200 },
  flights: { shortPerYear: 1, longPerYear: 0 },
  diet: "average",
  shopping: "average",
  digital: { aiPromptsPerDay: 10, aiMediaPerWeek: 0, streamingHoursPerDay: 2 },
};

const nonNeg = (n: number | undefined) => (Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0);

function category(
  key: CategoryKey,
  label: string,
  kg: number,
  confidence: Confidence,
  note?: string,
): CategoryResult {
  const margin = kg > 0 ? MARGINS[confidence] : 0;
  return { key, label, kg, confidence, margin, offsetKg: kg * (1 + margin), note };
}

export function gridKgPerKwh(state: StateCode): number {
  return (STATES[state].gridLbPerMwh * F.KG_PER_LB) / 1000;
}

export function computeFootprint(a: Answers): Footprint {
  const state = STATES[a.state];
  const people = Math.max(1, Math.round(a.householdSize) || 1);
  // Home energy is billed per household; personal habits are per person.
  const homeShare = a.scope === "individual" ? 1 / people : 1;
  const personCount = a.scope === "household" ? people : 1;
  const kgPerKwh = gridKgPerKwh(a.state);

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
    "Home electricity",
    kwh * kgPerKwh * homeShare,
    elecConfidence,
    `${Math.round(kwh)} kWh a month on the ${state.name} grid`,
  );

  // Heating
  const fuel = a.heating.fuel;
  let heatKg = 0;
  let heatConfidence: Confidence = "estimated";
  let heatNote: string | undefined;
  const bill = a.heating.mode === "bill" ? nonNeg(a.heating.billAmount) : 0;
  if (bill > 0) heatConfidence = "entered";
  if (fuel === "gas") {
    const therms = bill > 0 ? bill / F.GAS_PRICE_PER_THERM : F.AVG_THERMS_PER_MONTH;
    heatKg = therms * F.KG_CO2_PER_THERM_GAS;
    heatNote = `${Math.round(therms)} therms of natural gas a month`;
  } else if (fuel === "oil") {
    const gal = bill > 0 ? bill / F.OIL_PRICE_PER_GAL : F.AVG_OIL_GAL_PER_MONTH;
    heatKg = gal * F.KG_CO2_PER_GAL_HEATING_OIL;
    heatNote = `${Math.round(gal)} gallons of heating oil a month`;
  } else if (fuel === "propane") {
    const gal = bill > 0 ? bill / F.PROPANE_PRICE_PER_GAL : F.AVG_PROPANE_GAL_PER_MONTH;
    heatKg = gal * F.KG_CO2_PER_GAL_PROPANE;
    heatNote = `${Math.round(gal)} gallons of propane a month`;
  } else if (fuel === "electric") {
    heatNote = "Included in home electricity";
  } else {
    heatNote = "No fuel heating";
  }
  const heating = category("heating", "Home heating", heatKg * homeShare, heatConfidence, heatNote);

  // Car
  const milesPerMonth = nonNeg(a.car.milesPerWeek) * F.WEEKS_PER_MONTH;
  let carKg = 0;
  let carNote: string | undefined;
  if (a.car.type === "gas" || a.car.type === "hybrid") {
    const mpg = nonNeg(a.car.mpg) || (a.car.type === "hybrid" ? 50 : F.DEFAULT_MPG);
    carKg = (milesPerMonth / mpg) * F.KG_CO2_PER_GAL_GASOLINE;
    carNote = `${Math.round(milesPerMonth)} miles a month at ${mpg} mpg`;
  } else if (a.car.type === "electric") {
    const homeBillCoversIt = a.car.chargedAtHome && a.electricity.mode !== "average";
    if (homeBillCoversIt) {
      carNote = "Charged at home, so already in your electricity bill";
    } else {
      carKg = milesPerMonth * F.EV_KWH_PER_MILE * kgPerKwh;
      carNote = `${Math.round(milesPerMonth)} electric miles a month`;
    }
  }
  const car = category("car", "Car travel", carKg, "estimated", carNote);

  // Flights
  const short = nonNeg(a.flights.shortPerYear);
  const long = nonNeg(a.flights.longPerYear);
  const flights = category(
    "flights",
    "Flights",
    ((short * F.KG_PER_SHORT_ROUND_TRIP + long * F.KG_PER_LONG_ROUND_TRIP) * F.FLIGHT_NON_CO2_MULTIPLIER) / 12,
    "estimated",
    `${short} short and ${long} long round trips a year, spread over 12 months, including contrail effects`,
  );

  // Food and shopping
  const food = category("food", "Food", (F.DIET_KG_PER_YEAR[a.diet] / 12) * personCount, "estimated");
  const shopping = category(
    "shopping",
    "Goods and services",
    (F.SHOPPING_KG_PER_YEAR[a.shopping] / 12) * personCount,
    "estimated",
  );

  // Digital
  const d = a.digital;
  const usKgPerKwh = (F.US_GRID_LB_PER_MWH * F.KG_PER_LB) / 1000;
  const aiKwh =
    (nonNeg(d.aiPromptsPerDay) * F.DAYS_PER_MONTH * F.WH_PER_AI_PROMPT +
      nonNeg(d.aiMediaPerWeek) * F.WEEKS_PER_MONTH * F.WH_PER_AI_MEDIA) /
    1000;
  const streamKg = nonNeg(d.streamingHoursPerDay) * F.DAYS_PER_MONTH * F.KG_PER_STREAMING_HOUR;
  const digital = category(
    "digital",
    "AI and streaming",
    (aiKwh * usKgPerKwh + streamKg) * personCount,
    "estimated",
    "Data centers and networks only",
  );

  const categories = [electricity, heating, car, flights, food, shopping, digital];
  return {
    categories,
    totalKg: categories.reduce((s, c) => s + c.kg, 0),
    offsetKg: categories.reduce((s, c) => s + c.offsetKg, 0),
  };
}
