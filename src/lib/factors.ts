// Emission factors and national averages used by the questionnaire estimate.
// Values marked "approximate" are placeholders to verify before launch.

export const KG_PER_LB = 0.453592;

// EPA GHG Emission Factors Hub (approximate).
export const KG_CO2_PER_THERM_GAS = 5.3;
export const KG_CO2_PER_GAL_HEATING_OIL = 10.21;
export const KG_CO2_PER_GAL_PROPANE = 5.72;
export const KG_CO2_PER_GAL_GASOLINE = 8.89;

// Typical monthly fuel use for a home heated with each fuel, averaged over
// the year (approximate).
export const AVG_THERMS_PER_MONTH = 55;
export const AVG_OIL_GAL_PER_MONTH = 50;
export const AVG_PROPANE_GAL_PER_MONTH = 60;

// Typical retail prices, used to turn a bill amount into fuel (approximate).
export const GAS_PRICE_PER_THERM = 1.5;
export const OIL_PRICE_PER_GAL = 3.8;
export const PROPANE_PRICE_PER_GAL = 2.6;

// Cars.
export const DEFAULT_MPG = 25;
export const EV_KWH_PER_MILE = 0.3;

// Flights, per passenger, round trip (approximate). A short trip is about
// 2 x 800 miles at 0.129 kg/mile; a long trip about 2 x 4,000 miles at
// 0.163 kg/mile (EPA medium- and long-haul factors).
export const KG_PER_SHORT_ROUND_TRIP = 206;
export const KG_PER_LONG_ROUND_TRIP = 1304;
// Contrails and other high-altitude effects add warming beyond the CO2.
// UK government (DESNZ/DEFRA) factors use about 1.7x (approximate).
export const FLIGHT_NON_CO2_MULTIPLIER = 1.7;

// Food, per person per year (approximate).
export const DIET_KG_PER_YEAR = {
  "meat-heavy": 3300,
  average: 2500,
  vegetarian: 1700,
  vegan: 1500,
} as const;

// Goods and services, per person per year (approximate).
export const SHOPPING_KG_PER_YEAR = {
  low: 2500,
  average: 5000,
  high: 8000,
} as const;

// Digital use. Data center and network share only; the device's own power is
// already in the home electricity bill.
// Text prompt: ~0.3 Wh (Epoch AI). Image or video generation: rough placeholder.
// Streaming: ~36 g CO2 per hour (IEA).
export const WH_PER_AI_PROMPT = 0.3;
export const WH_PER_AI_MEDIA = 10;
export const KG_PER_STREAMING_HOUR = 0.036;
export const US_GRID_LB_PER_MWH = 770.9;

export const DAYS_PER_MONTH = 30.4;
export const WEEKS_PER_MONTH = 4.35;
