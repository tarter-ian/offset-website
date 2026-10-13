import * as F from "./factors";
import { AI_LEVELS } from "./ai/levels";
import { IMPACT_KEYS, type ImpactKey, type Impacts } from "./footprint";
import { impactCost } from "./pricing";
import { CHARITIES, type Charity } from "./charities";
import type { Product } from "./store";

// Plain-language notes on how each item is estimated, for the (i) on its tile.
// The method page has the full sources.

const g = (kg: number) => `${Math.round(kg * 1000)} g`;

const ONLINE_NOTE =
  `Hours a day times the energy of the data centers and networks behind it, on the US grid, plus the water to cool them and a share of building the servers and buildings (+${Math.round(F.DATACENTER_BUILD_SHARE * 100)}% carbon). Your own device's power is counted under Devices. These figures are rough, so I add a wider margin.`;

// What the aisle notes under Online and Devices used to say, now in each item's (i) (Ian, 2026-10-13).
const TYPICAL_NOTE = "No account can measure this yet, so it starts from typical use.";

const DEVICE_NOTE = (id: keyof typeof F.DEVICES) => {
  const d = F.DEVICES[id];
  return [
    `Making one takes about ${d.kgToMake} kg of CO₂e, and I assume you replace it every ${d.yearsKept} years.`,
    `Running it uses about ${d.kwhPerYear} kWh a year on the US grid.`,
    "Includes paying to reuse or recycle each one when you replace it.",
    TYPICAL_NOTE,
    "Water consumed and land used to mine and make it are scaled from studies of smartphones by the carbon to make each device. Air pollution from the factories uses the EPA's supply-chain rate for manufactured goods, likely an underestimate.",
    `Lifetime covers every one you'll go through until age ${F.LIFETIME_TO_AGE}, with their power on a grid getting cleaner each year to ${F.GRID_CLEANER_UNTIL}.`,
  ];
};

const GOODS_USD_NOTE = (k: keyof typeof F.GOODS_KG_CO2_PER_USD) =>
  `About ${F.GOODS_KG_CO2_PER_USD[k]} kg CO₂e for each dollar spent, from the EPA's supply-chain model. The default, $${F.GOODS_USD_PER_MONTH[k]} a month, is a typical American's spending (BLS, 2024). If the My Offset extension finds you spend more than that on Amazon alone, I use your Amazon figure instead. Amazon splits an order's cost evenly over its items, so a mixed order is rough.`;

const FOOD_NOTE = (what: string) => [
  `Yearly per-person carbon, water and land for your type of diet, with ${what} taking its typical share.`,
  "Air pollution is your share of the farm pollution deaths in the US each year, mostly from ammonia off manure and fertilizer, scaled by your diet.",
];

const SHOPPING_NOTE = (what: string, share: number) => [
  `A yearly per-person carbon figure for your level of spending, with ${what} taking about ${Math.round(share * 100)}% of it.`,
];

const GOODS_NOTE = "Water, land and air pollution scale with the carbon, using the EPA's supply-chain model of US spending.";

export const HOW_ESTIMATED: Record<string, string[]> = {
  ai: [
    `About ${F.WH_PER_AI_PROMPT} Wh a prompt, or each prompt measured from your ChatGPT, Claude or Gemini export if you link it.`,
    `How many prompts: the light (${AI_LEVELS.light.promptsPerDay} a day), medium (${AI_LEVELS.medium.promptsPerDay}) or heavy (${AI_LEVELS.heavy.promptsPerDay}) you pick, the real count from the My Offset extension or your export, or your own count of chats (${F.PROMPTS_PER_CHAT} prompts a chat, the middle of published chatbot logs). Light is the average ChatGPT user and medium the average daily user, from OpenAI's prompt and user counts; heavy is my estimate for people who use it for hours a day.`,
    `Also counts the AI built into search and other apps, such as Google's AI answers and email summaries, as ${F.AI_BUILT_IN_PROMPTS_PER_DAY} typical prompts a day since mid-2024.`,
    `Adds each prompt's share of training the models (${Math.round(F.AI_TRAINING_SHARE * 100)}% of AI energy) and of making the chips and buildings (+${Math.round(F.AI_HARDWARE_SHARE * 100)}% carbon).`,
    "Power is on the US grid; water is the power plants' plus data center cooling.",
    `Lifetime assumes use until age ${F.LIFETIME_TO_AGE}, allows for it to grow, and counts the grid getting cleaner each year to ${F.GRID_CLEANER_UNTIL} (cooling water isn't discounted).`,
  ],
  "ai-media": [`About ${F.WH_PER_AI_MEDIA} Wh a picture, with the same training, hardware and water as chat.`],
  "ai-video": [
    `About ${F.WH_PER_AI_VIDEO} Wh for a 5-second clip, the one published measurement (an open model, measured for MIT Technology Review in 2025). Commercial video models don't publish theirs.`,
    "Same training, hardware and water as chat. Past use counts from late 2024, when video tools opened to the public.",
  ],
  video: [
    `About ${F.STREAMING_KWH_PER_HOUR} kWh and ${g(F.KG_PER_STREAMING_HOUR)} of CO₂ an hour, from the IEA.`,
    "If the extension counts your whole history, past watching is measured from YouTube's hours and Netflix's titles (about 40 minutes each), and only the years before that history starts are estimated.",
    "Can be measured from your YouTube or Netflix history; otherwise it starts from typical use.",
    ONLINE_NOTE,
  ],
  "ai-coding": [
    `About ${F.WH_PER_CLAUDE_CODE_HOUR} Wh an hour of a coding agent working (published estimates run ${F.WH_PER_CLAUDE_CODE_HOUR_RANGE[0]} to ${F.WH_PER_CLAUDE_CODE_HOUR_RANGE[1]} Wh). Using a Claude plan's whole weekly limit is about ${F.CLAUDE_WEEKLY_HOURS.pro} hours a week on Pro and ${F.CLAUDE_WEEKLY_HOURS.max_5x} on Max 5x.`,
    `Linking Claude fills this in from how much of your plan's weekly limit you've used beyond your chats, which includes Claude Code, turned into hours from Anthropic's published limits. Linking ChatGPT adds its agent and Codex tools from their token totals, at about ${F.WH_PER_MILLION_AGENT_TOKENS} Wh a million tokens.`,
    "Cursor, Copilot and coding through an API key can't be seen from your accounts, so add those hours yourself.",
    "Same training, hardware and water as chat. Past use counts from 2025, when coding agents took off.",
  ],
  social: [ONLINE_NOTE, TYPICAL_NOTE],
  gaming: [ONLINE_NOTE, TYPICAL_NOTE],
  calls: [ONLINE_NOTE, TYPICAL_NOTE],
  music: ["Can be measured from your Spotify history; otherwise it starts from typical use.", ONLINE_NOTE],
  browsing: [ONLINE_NOTE, TYPICAL_NOTE],
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
    `Your gas bill divided by about $${F.GAS_PRICE_PER_THERM} a therm, at ${F.KG_CO2_PER_THERM_GAS} kg CO₂ a therm, or your oil or propane bill by its price a gallon.`,
    "Plus the NOx and fine particles from burning it at home, from the EPA's furnace emission factors for each fuel.",
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
  rideshare: [
    `Each ride mile counts as ${F.RIDESHARE_EMPTY_MILES} miles in an average gas car, adding the driving between fares and to pick you up (California Air Resources Board).`,
    "Measured from your Uber trips by the My Offset extension.",
  ],
  delivery: [
    `Each delivery counts as about ${F.MILES_PER_DELIVERY} miles in an average gas car: the courier's drive to the restaurant and on to you. The food itself is under your diet; packaging isn't counted yet.`,
    "Measured from your DoorDash and Uber Eats orders by the My Offset extension; pickups don't count.",
  ],
  clothing: [
    GOODS_USD_NOTE("clothing"),
    "Water, land and air pollution scale with the carbon, using the EPA's supply-chain model of US spending. Water is raised for cotton grown abroad, from Levi's study of a pair of jeans.",
  ],
  electronics: [
    GOODS_USD_NOTE("electronics"),
    "Water consumed and land used to mine and make them are scaled from studies of smartphones. Air pollution from the factories uses the EPA's supply-chain rate for manufactured goods.",
  ],
  household: [GOODS_USD_NOTE("household"), GOODS_NOTE],
  othergoods: [
    `About ${F.GOODS_KG_CO2_PER_USD.household} kg CO₂e a dollar, the EPA's rate for household goods, the closest of its groups. The default, $${F.GOODS_USD_PER_MONTH.other} a month, is a typical American's spending on toys, books, pets and personal care.`,
    GOODS_NOTE,
  ],
  services: [...SHOPPING_NOTE("services", F.SHOPPING_SHARES.services), GOODS_NOTE],
};

export const howEstimated = (p: Product): string[] => HOW_ESTIMATED[p.id] ?? [];

/** Who gets an item's donation, and each charity's share of it. */
/** One row per charity: a charity that takes more than one harm (CATF does climate and air) shows once, with its shares added. */
export function whereItGoes(i: Impacts): { key: ImpactKey; charity: Charity; share: number }[] {
  const c = impactCost(i);
  const total = IMPACT_KEYS.reduce((s, k) => s + c[k], 0);
  if (total <= 0) return [];
  const rows = new Map<string, { key: ImpactKey; charity: Charity; share: number; keys: ImpactKey[] }>();
  for (const k of IMPACT_KEYS) {
    const share = c[k] / total;
    const row = rows.get(CHARITIES[k].name);
    if (row) {
      row.share += share;
      row.keys.push(k);
    } else rows.set(CHARITIES[k].name, { key: k, charity: CHARITIES[k], share, keys: [k] });
  }
  return [...rows.values()]
    .filter((r) => r.share >= 0.005)
    .map(({ key, charity, share, keys }) => ({
      key,
      charity: keys.length > 1 && JOINT_FOCUS[charity.name] ? { ...charity, focus: JOINT_FOCUS[charity.name] } : charity,
      share,
    }))
    .sort((a, b) => b.share - a.share);
}

/** What a charity that takes several harms does, for its one row. */
const JOINT_FOCUS: Record<string, string> = {
  "Clean Air Task Force": "Climate and clean air: pushed the rules that cut soot and smog from US power plants and diesel engines",
};
