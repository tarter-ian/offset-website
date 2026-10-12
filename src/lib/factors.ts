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
/**
 * Courier miles per food delivery: driving to the restaurant and on to you,
 * our estimate from driver mileage logs (paid trips run about 4 to 5 miles,
 * plus the drive to pick up). Packaging isn't counted.
 */
export const MILES_PER_DELIVERY = 6;
/**
 * Ride-hailing drives about 40% more miles than the rides themselves, between
 * fares and on the way to pickups (California Air Resources Board, SB 1014
 * baseline, 2019). Default: our estimate, about one short ride a week.
 */
export const RIDESHARE_EMPTY_MILES = 1.4;
export const RIDESHARE_MILES_PER_WEEK = 5;
/** DoorDash handled 2.6 billion orders in 2024 for 42 million monthly users: about 1.2 a week each (DoorDash 2024 annual report). */
export const DELIVERIES_PER_WEEK = 1;
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
// Text prompt: ~0.3 Wh (Epoch AI). Image generation: rough placeholder.
// Streaming: ~36 g CO2 per hour (IEA).
export const WH_PER_AI_PROMPT = 0.3;
export const WH_PER_AI_MEDIA = 10;
// A 5-second AI video: ~3.4 MJ, about 944 Wh, measured on an open model
// (CogVideoX) for MIT Technology Review with Hugging Face (May 2025). Commercial
// models aren't published; this is the only measured figure.
export const WH_PER_AI_VIDEO = 944;
// AI built into other products: search answers (Google's AI Overviews), email and
// document summaries, assistants in apps. A US Google user averages 4.2 searches
// a day (median 1.8; SparkToro via Exploding Topics, 2026) and 43% of US searches
// showed an AI Overview in May 2026 (Similarweb), about 1.8 AI answers a day.
// With email and document summaries and assistants in other apps on top, we
// count 4 typical prompts a day for everyone (Ian, 2026-10-12, matching the US
// search average), from mid-2024 when AI search answers rolled out. Rough.
export const AI_BUILT_IN_PROMPTS_PER_DAY = 4;
export const AI_BUILT_IN_START_YEAR = 2024.4;
export const AI_VIDEO_START_YEAR = 2024.9;
// Measuring a data export: energy scales with tokens. Epoch AI puts a short
// reply (~500 tokens out) at ~0.3 Wh and a 10k-token input at ~2.5 Wh. Each turn
// of a chat re-reads the whole conversation so far, so long chats cost more.
// Reasoning models write hidden thinking tokens the export doesn't show.
export const CHARS_PER_TOKEN = 4;
export const WH_PER_OUTPUT_TOKEN = 0.0006;
export const WH_PER_INPUT_TOKEN = 0.00025;
export const REASONING_OUTPUT_MULTIPLIER = 4;
// Input served from a prompt cache skips most of the work.
export const CACHED_INPUT_SHARE = 0.1;
// Claude Code and other apps on a Claude plan don't show up in the chat list,
// only in the share of the weekly limit used. Anthropic gives each plan's weekly
// limit in hours of Sonnet use (support.claude.com, 2025); we take the low end.
// An hour of Claude Code is ~120 Wh (range 40 to 350): Anthropic's ~$13 a
// developer-day as Sonnet tokens (mostly cache reads), at per-token energy
// worked back from Epoch AI (Couch 2026) and Google's 2025 measurements.
// Checked against published heavy users: Couch (Jan 2026) ~1.3 kWh on a median
// day, Hausfather (The Climate Brink, 2026) ~3.0 kWh a day (1.2 to 5.9). A full
// Max 5x week at this rate is 2.4 kWh a day, inside that range.
// Prompts per chat, for turning a count of chats into prompts. Real chatbot logs
// average 2.5 (WildChat, 1M ChatGPT chats) to 3.5 (ShareGPT, chats people chose
// to share) prompts per chat (Zhao et al. 2024, table 1). We take 3.
export const PROMPTS_PER_CHAT = 3;
export const CLAUDE_WEEKLY_HOURS = { pro: 40, max_5x: 140, max_20x: 240 } as const;
export const WH_PER_CLAUDE_CODE_HOUR = 120;
// Share of machine learning energy spent training models rather than answering
// prompts (Patterson et al. 2022, Google: about 2/5 training, 3/5 inference).
// Each prompt carries its share of training.
export const AI_TRAINING_SHARE = 0.4;
// Making the chips and servers and building the data centers, as a share of
// AI's total carbon (rough; life-cycle studies of AI hardware put manufacturing
// at roughly a fifth to a third).
export const AI_HARDWARE_SHARE = 0.25;
// Building ordinary data centers and their servers. Embodied emissions are a
// fifth to a third of a data center's life-cycle carbon (Gupta et al. 2021,
// "Chasing Carbon"; Microsoft and Meta disclosures); we use the same quarter as AI.
export const DATACENTER_BUILD_SHARE = 0.25;
// Some data centers run on-site gas turbines and diesel backup, which pollute
// more locally than the grid average (rough).
export const AI_LOCAL_AIR_WEIGHT = 1.2;

// Water is weighted by scarcity: a liter from a water-stressed basin counts in
// full, a liter from a basin with plenty counts a fifth (the ISO 14046 idea,
// simplified). Stressed shares are rough: about two thirds of data centers
// built since 2022 are in stressed areas (Bloomberg 2025); much US irrigation is
// in the dry West; power plant cooling is spread more evenly.
export const UNSTRESSED_WATER_WEIGHT = 0.2;
export const STRESSED_WATER_SHARE = { grid: 0.4, datacenter: 2 / 3, food: 0.6 } as const;
export const scarcityWeight = (source: keyof typeof STRESSED_WATER_SHARE) =>
  STRESSED_WATER_SHARE[source] + (1 - STRESSED_WATER_SHARE[source]) * UNSTRESSED_WATER_WEIGHT;
export const KG_PER_STREAMING_HOUR = 0.036;
export const US_GRID_LB_PER_MWH = 770.9;

// The US grid gets cleaner over time. EIA's 2025 outlook (full IRA) has power
// CO2 per kWh falling ~6% a year to 2050; its no-IRA case ~2%. With 2025's cuts
// to clean-power credits we take the cautious 2% a year to 2050, then flat.
// Applied to future power use in lifetime prices, for carbon and power plant water.
export const GRID_CLEANER_PER_YEAR = 0.02;
export const GRID_CLEANER_UNTIL = 2050;
// Power plant SO2 and NOx fall faster than CO2 because coal, their main source,
// retires first: in 2023 SO2 fell 24% and NOx 15% against CO2's 7% (EPA Power
// Sector Progress Report). We take twice the carbon rate for air.
export const GRID_AIR_CLEANER_PER_YEAR = 0.04;

/** Years of future power use, counted at the grid each year is expected to have, from `from` for `years`. */
export function gridYears(from: number, years: number, rate = GRID_CLEANER_PER_YEAR): number {
  const r = 1 - rate;
  const declining = Math.max(0, Math.min(years, GRID_CLEANER_UNTIL - from));
  // Integral of r^t from 0 to the end of the decline, then flat at its final level.
  const k = Math.log(r);
  return (Math.pow(r, declining) - 1) / k + (years - declining) * Math.pow(r, declining);
}

export const DAYS_PER_MONTH = 30.4;
export const WEEKS_PER_MONTH = 4.35;

// ---------------------------------------------------------------------------
// Air pollution: health damage in dollars.

// Shown to people as healthy life lost rather than dollars. The damage values are
// almost all early deaths, valued at EPA's value of a statistical life (about $10M
// in the 2016 dollars they use; $7.4M in 2006 dollars). Each early death from fine
// particles costs about 8.5 years of life (Fann et al. 2012: 1.1 million life years
// over 130,000 deaths). So $1 of damage is roughly 0.45 minutes of life, spread
// across everyone who breathes the pollution.
export const VSL_USD = 10_000_000;
export const LIFE_YEARS_PER_AIR_DEATH = 8.5;
export const MINUTES_OF_LIFE_PER_DAMAGE_USD = (LIFE_YEARS_PER_AIR_DEATH * 365.25 * 24 * 60) / VSL_USD;

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
// Heating oil furnace, AP-42 section 1.3 (residential, No. 2 oil): NOx 18 lb and
// particles 0.4 lb filterable + 1.3 lb condensable per 1,000 gallons. Today's
// ultra-low-sulfur heating oil makes SO2 negligible.
export const OIL_G_NOX_PER_GAL = 18 * 0.4536;
export const OIL_G_PM25_PER_GAL = 1.7 * 0.4536;
// Propane, AP-42 section 1.5: NOx 13 lb and particles 0.7 lb per 1,000 gallons.
export const PROPANE_G_NOX_PER_GAL = 13 * 0.4536;
export const PROPANE_G_PM25_PER_GAL = 0.7 * 0.4536;

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

// Power plants, their fuel and their sites, per kWh on the US grid: median land
// use for each source (Lovering et al. 2022, PLOS ONE, ha per TWh a year)
// weighted by the 2023 US mix. Wind counts only its pads and roads, since the
// land between turbines stays in use. About 500 ha/TWh. Rough.
export const GRID_M2_YEARS_PER_KWH = 0.005;
// Data center campuses take roughly an acre per megawatt of power; running
// most of the year, that's about this much land per kWh. Rough.
export const DATACENTER_M2_YEARS_PER_KWH = 0.0005;

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

// Air pollution from farms (mostly ammonia from manure and fertilizer, which
// forms fine particles). Domingo et al. 2021 (PNAS) estimate 15,900 US deaths a
// year from food production: cutting meat (a vegetarian diet) avoids 76% of them
// and also cutting dairy and eggs (vegan) avoids 83%. So of the average diet's
// damage, meat is 76%, dairy and eggs 7%, plant foods 17%. Other diets scale each
// group by its share of the diet's carbon.
export const FOOD_AIR_DEATHS_PER_YEAR = 15_900;
export const US_POPULATION = 332_000_000;
export const FOOD_AIR_SHARES = { meat: 0.76, dairy: 0.07, plants: 0.17 } as const;

// Water used to drill and refine fuel: about 1.5 gallons per gallon of gasoline
// or jet fuel (Wu et al. 2009, Argonne; range 0.5 to 2.5). Per kg of CO2 burned.
export const FUEL_WATER_L_PER_KG_CO2 = (1.5 * 3.785) / KG_CO2_PER_GAL_GASOLINE;

// Flights' air pollution: about 16,000 deaths a year worldwide (Yim et al. 2015)
// from about 188 million tonnes of jet fuel, so about $850 of health damage per
// tonne of fuel, or $0.27 per kg of CO2. Approximate: three quarters come from
// cruise emissions that spread far from where the flight happened.
export const FLIGHT_AIR_DEATHS_PER_YEAR = 16_000;
export const JET_FUEL_TONNES_PER_YEAR = 188_000_000;
export const KG_CO2_PER_KG_JET_FUEL = 3.16;

// Making electronics, per kg of manufacturing CO2e, applied to every device type.
// Water is fresh water consumed (not returned), from the Fairphone 5 LCA: 223 L
// against 32.7 kg CO2e to produce it (Fraunhofer for Fairphone, 2024). We count
// water consumed everywhere else too, so polluted (grey) water is left out.
// Land is a smartphone's ~18 m² against ~70 kg CO2e (Friends of the Earth 2015).
export const ELECTRONICS_L_PER_KG_CO2 = 223 / 32.7;
export const ELECTRONICS_M2_PER_KG_CO2 = 18 / 70;
// Air pollution from making electronics: EPA USEEIO's PM2.5 for manufactured
// household goods per kg CO2e, priced like other supply chains below. Chip and
// screen factories run largely on coal power in East Asia, so this likely
// understates it. Approximate.
export const ELECTRONICS_PM25_PER_KG_CO2 = 3.8e-4;
// E-waste from the electronics you buy, per kg of making CO2e: from about 0.003
// (a phone) to 0.04 (a TV) in the device table below; we take 0.01 for a mix.
export const EWASTE_KG_PER_KG_CO2 = 0.01;

// Clothing, home goods and services, per kg CO2e, from EPA USEEIO v2.0.1
// supply-chain intensities, weighted by US household spending (2012). Land is
// USEEIO's land occupation (m²·yr) and air its PM2.5-equivalent respiratory
// effects. USEEIO counts water withdrawn, so consumed water is derived with
// USGS consumptive-use fractions (Circular 1200). USEEIO models imports as US-made,
// which understates clothing water (irrigated cotton is mostly imported): Levi's
// 501 LCA (2015) gives ~113 L/kg, so clothing uses the middle of 24 to 113.
export const GOODS_PER_KG_CO2 = {
  clothing: { water: 60, land: 3.4, pm25: 6.2e-4 },
  household: { water: 10, land: 1.5, pm25: 3.8e-4 },
  services: { water: 10, land: 1.2, pm25: 4.0e-4 },
} as const;
// Supply-chain PM2.5 is mostly from factories and power plants, often far from
// cities and some abroad, so it gets an industrial rate, not the tailpipe one:
// roughly the middle of EPA's benefit-per-ton figures for industrial sectors
// (2018 technical support document, $140k to $470k). Approximate.
export const GOODS_USD_PER_TON_PM25 = 250_000;

// Goods priced by the dollar, for the Shopping cards. Supply-chain kg CO2e per
// dollar at purchaser prices, approximate, from EPA USEEIO v2.0.1 (apparel,
// computers and electronics, furniture and household goods, and other
// manufactured goods such as toys, books and personal care).
export const GOODS_KG_CO2_PER_USD = { clothing: 0.4, electronics: 0.3, household: 0.45 } as const;
// Default dollars a month per person: BLS Consumer Expenditure Survey 2024
// ($2,001 a year on apparel, about $2,550 on household furnishings and
// equipment, about $700 on electronics and computers, about $1,200 on toys,
// pets, reading and personal care products, per household of 2.5 people).
export const GOODS_USD_PER_MONTH = { clothing: 67, electronics: 25, household: 85, other: 40 } as const;

// How goods and services split.
export const SHOPPING_SHARES = { clothing: 0.15, electronics: 0.15, household: 0.15, services: 0.55 } as const;

// ---------------------------------------------------------------------------
// Lifetime internet and AI.

// Data center and network electricity per hour of each activity. Video is the
// IEA figure; the others are scaled from typical data use and are rough.
export const INTERNET_KWH_PER_HOUR = {
  video: 0.077,
  social: 0.06,
  gaming: 0.2,
  calls: 0.03,
  music: 0.005,
  browsing: 0.01,
} as const;
// Extra margin on the rough activity figures (everything but video).
export const INTERNET_ROUGH_MARGIN = 0.5;
// Years we count back to: mainstream home internet and ChatGPT's launch.
export const INTERNET_START_YEAR = 1995;
export const AI_START_YEAR = 2022.9;
// Unmeasured past AI use grows steadily from zero to today's rate, so on
// average it's half of today's rate (Ian, 2026-10-12).
export const AI_PAST_RAMP = 0.5;
// A chat with no measured prompts counts as three (WildChat 2.5, ShareGPT 3.5).
export const AI_PROMPTS_PER_CHAT = 3;
export const ONLINE_FROM_AGE = 12;
export const LIFETIME_TO_AGE = 85;

// Devices: carbon to make one (manufacturer life-cycle reports, rounded and
// rough), typical years before it's replaced, the electricity it uses a year,
// and what it weighs when thrown away (typical models; a desktop includes its
// monitor). Making devices is often the largest part of a digital footprint.
export const DEVICES = {
  phone: { kgToMake: 70, yearsKept: 3, kwhPerYear: 5, kgWeight: 0.2 },
  laptop: { kgToMake: 250, yearsKept: 5, kwhPerYear: 50, kgWeight: 2 },
  tablet: { kgToMake: 100, yearsKept: 4, kwhPerYear: 15, kgWeight: 0.5 },
  desktop: { kgToMake: 500, yearsKept: 6, kwhPerYear: 200, kgWeight: 12 },
  tv: { kgToMake: 400, yearsKept: 8, kwhPerYear: 100, kgWeight: 15 },
  console: { kgToMake: 150, yearsKept: 7, kwhPerYear: 100, kgWeight: 4 },
} as const;
