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

// ---------------------------------------------------------------------------
// Air pollution: health damage in dollars.

/** Grams in a US short ton, the unit the damage values use. */
export const G_PER_SHORT_TON = 907_185;
export const LB_PER_SHORT_TON = 2000;

// Power plants, EPA BenMAP sector benefit-per-ton, 2025, 2016 dollars,
// 2% discount rate. NOx includes its PM2.5 and ozone effects.
// https://epa.gov/benmap/sector-based-pm25-and-ozone-benefit-ton-estimates
export const POWER_USD_PER_TON_NOX = 7_710 + 98_900;
export const POWER_USD_PER_TON_SO2 = 57_000;

// Ground-level sources (cars, home furnaces), Wolfe et al. 2019 on-road
// light-duty gasoline values, Krewski model, 2015 dollars, 3% discount rate.
// We also use these for home furnaces as an approximation.
export const GROUND_USD_PER_TON_NOX = 7_100;
export const GROUND_USD_PER_TON_PM25 = 700_000;

// Gasoline car tailpipe, EPA420-F-08-024 (2008). Overstates today's cars;
// replace with current MOVES rates (BTS NTS Table 4-43).
export const CAR_G_NOX_PER_MILE = 0.693;
export const CAR_G_PM25_PER_MILE = 0.0041;

// Natural gas furnace, EPA AP-42 section 1.4.
export const GAS_G_NOX_PER_THERM = 4.2;
export const GAS_G_PM25_PER_THERM = 0.34;

// ---------------------------------------------------------------------------
// Water consumed, in liters.

// US grid average consumption (not withdrawal), as used in Li et al.,
// "Making AI Less Thirsty". https://arxiv.org/html/2304.03271v4
export const GRID_L_PER_KWH = 3.14;
// Data center on-site cooling, implied by Google's Aug 2025 Gemini figures
// (0.26 mL for 0.24 Wh).
// https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference
export const DATACENTER_L_PER_KWH = 1.1;
export const STREAMING_KWH_PER_HOUR = 0.077;

// Food, liters per person per day, Scarborough et al. 2023 (Nature Food).
export const DIET_L_PER_DAY = {
  "meat-heavy": 890,
  average: 780,
  vegetarian: 530,
  vegan: 410,
} as const;

// ---------------------------------------------------------------------------
// Nature: land occupied, in square meter-years.

// Food, per person per year, Scarborough et al. 2023.
export const DIET_M2_PER_YEAR = {
  "meat-heavy": 6125,
  average: 4117,
  vegetarian: 2194,
  vegan: 1595,
} as const;

export const M2_PER_ACRE = 4046.86;

// ---------------------------------------------------------------------------
// Subcategory splits (approximate shares, to refine).

// Bus and train, kg CO2e per passenger-mile (approximate EPA average).
export const TRANSIT_KG_PER_MILE = 0.1;

// How each diet's food footprint splits between food groups.
export const FOOD_SHARES = {
  "meat-heavy": { meat: 0.6, dairy: 0.2, plants: 0.2 },
  average: { meat: 0.5, dairy: 0.25, plants: 0.25 },
  vegetarian: { meat: 0, dairy: 0.45, plants: 0.55 },
  vegan: { meat: 0, dairy: 0, plants: 1 },
} as const;

// How goods and services split.
export const SHOPPING_SHARES = { clothing: 0.15, electronics: 0.15, household: 0.15, services: 0.55 } as const;

// ---------------------------------------------------------------------------
// Lifetime internet and AI.

// Video makes up most internet traffic; we scale streaming up to cover the rest
// of a person's internet use (approximate share).
export const VIDEO_SHARE_OF_INTERNET = 0.7;
// Years we count back to: mainstream home internet and ChatGPT's launch.
export const INTERNET_START_YEAR = 1995;
export const AI_START_YEAR = 2022.9;
export const ONLINE_FROM_AGE = 12;
export const LIFETIME_TO_AGE = 85;
