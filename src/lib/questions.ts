import * as F from "./factors";
import { aiImpacts, dataCenterImpacts, MARGINS, type Impacts } from "./footprint";
import { impactCost, recurringPrice } from "./pricing";
import { DEFAULT_CONTEXT, KG_PER_CAR_MILE, planTotals, productById, type Context } from "./store";
import { AI_LEVELS } from "./ai/levels";

// Numbers for the question pages, worked out from the same factors the
// calculator uses so the answers move when the method does.

export interface Question {
  slug: string;
  /** The question as people search it, used as the page heading. */
  question: string;
  /** Page title for search results. */
  title: string;
  description: string;
}

export const QUESTIONS: Question[] = [
  {
    slug: "how-much-energy-does-a-chatgpt-prompt-use",
    question: "How much energy does a ChatGPT prompt use?",
    title: "How much energy does a ChatGPT prompt use? | My Offset",
    description: `About ${F.WH_PER_AI_PROMPT} Wh to answer a typical prompt, or more with its share of training the model. The carbon, air pollution and what it costs to cover.`,
  },
  {
    slug: "how-much-water-does-chatgpt-use",
    question: "How much water does ChatGPT use?",
    title: "How much water does ChatGPT use? | My Offset",
    description: "A few milliliters a prompt, counting both data center cooling and the power plants behind it. Worked out from published figures.",
  },
  {
    slug: "netflix-streaming-carbon-footprint",
    question: "What is the footprint of an hour of Netflix?",
    title: "What is the carbon footprint of an hour of Netflix or video streaming? | My Offset",
    description: "The data centers and networks behind an hour of streaming video, in carbon, water and air pollution, and what it costs to cover.",
  },
  {
    slug: "claude-code-energy-use",
    question: "What is the footprint of Claude Code and other AI coding agents?",
    title: "What is the footprint of Claude Code and AI coding agents? | My Offset",
    description: "An hour of an AI coding agent uses far more energy than a chat prompt. Our estimate per hour and per month, and what it costs to cover.",
  },
];

export const questionBySlug = (slug: string) => QUESTIONS.find((q) => q.slug === slug);

/** Sum of the five impact prices, before minimums and fees. */
export const coverCost = (i: Impacts) => {
  const c = impactCost(i);
  return c.carbon + c.air + c.water + c.land + c.ewaste;
};

/** Each harm plus the margin we add to estimates, which is what gets covered. */
const withMargin = (i: Impacts): Impacts => {
  const k = 1 + MARGINS.estimated;
  return { carbon: i.carbon * k, air: i.air * k, water: i.water * k, land: i.land * k, ewaste: i.ewaste * k };
};

/** Liters of water consumed for server energy (kWh), not weighted by scarcity: cooling on site, and the power plants. */
export function rawWater(serverKwh: number) {
  const cooling = serverKwh * F.DATACENTER_L_PER_KWH;
  const power = (serverKwh / (1 - F.GRID_LINE_LOSS)) * F.GRID_L_PER_KWH;
  return { cooling, power, total: cooling + power };
}

/** One AI answer that took `answerWh` to produce: energy with training, carbon, air, water. */
export function aiAnswer(answerWh: number) {
  const totalWh = answerWh / (1 - F.AI_TRAINING_SHARE);
  const impacts = aiImpacts(answerWh / 1000);
  return { answerWh, totalWh, impacts, water: rawWater(totalWh / 1000) };
}

/** What a month of AI use (answer energy in Wh) costs to cover, as donations, with our margin for estimates. */
export function aiMonthCost(answerWhPerMonth: number) {
  const covered = withMargin(aiImpacts(answerWhPerMonth / 1000));
  const donation = coverCost(covered);
  return { impacts: aiImpacts(answerWhPerMonth / 1000), donation };
}

/** A typical chatbot user: the medium level, plus the AI built into search and other apps. */
export const TYPICAL_PROMPTS_PER_DAY = AI_LEVELS.medium.promptsPerDay;

export function typicalChatMonth(ctx: Context = DEFAULT_CONTEXT) {
  const ai = productById("ai")!;
  const promptsPerMonth = (TYPICAL_PROMPTS_PER_DAY + F.AI_BUILT_IN_PROMPTS_PER_DAY) * F.DAYS_PER_MONTH;
  const answerWh = promptsPerMonth * F.WH_PER_AI_PROMPT;
  const impacts = aiImpacts(answerWh / 1000);
  // The site's own price for this item, so the page and the calculator agree.
  const donation = ai.cost(TYPICAL_PROMPTS_PER_DAY, "monthly", ctx);
  return {
    promptsPerMonth,
    answerWh,
    impacts,
    water: rawWater(answerWh / (1 - F.AI_TRAINING_SHARE) / 1000),
    donation,
    ...itemCharges("ai", TYPICAL_PROMPTS_PER_DAY, ctx),
  };
}

/** What the plan would charge for one item on its own: each month, or once for past use and life. */
export function itemCharges(productId: string, amount: number, ctx: Context = DEFAULT_CONTEXT) {
  const monthly = planTotals([{ productId, amount, cover: { past: false, ahead: "monthly" } }], ctx, "monthly").recurring!;
  const lifetime = planTotals([{ productId, amount, cover: { past: true, ahead: "lifetime" } }], ctx).oneTime!;
  return { monthly, lifetime };
}

/** An hour of streamed video: data centers and networks only. */
export function streamingHour() {
  const kwh = F.STREAMING_KWH_PER_HOUR;
  const impacts = dataCenterImpacts(kwh);
  return { kwh, impacts, water: rawWater(kwh), carMiles: impacts.carbon / KG_PER_CAR_MILE };
}

export const TYPICAL_STREAMING_HOURS_PER_DAY = productById("video")!.amount.default as number;

export function typicalStreamingMonth(ctx: Context = DEFAULT_CONTEXT) {
  const video = productById("video")!;
  const hours = TYPICAL_STREAMING_HOURS_PER_DAY * F.DAYS_PER_MONTH;
  const donation = video.cost(TYPICAL_STREAMING_HOURS_PER_DAY, "monthly", ctx);
  return {
    hours,
    impacts: dataCenterImpacts(hours * F.STREAMING_KWH_PER_HOUR),
    donation,
    ...itemCharges("video", TYPICAL_STREAMING_HOURS_PER_DAY, ctx),
  };
}

/** An hour of Claude Code or a similar coding agent. */
export const codingHour = () => aiAnswer(F.WH_PER_CLAUDE_CODE_HOUR);

/** A month of using a whole Claude plan's weekly limit every week. */
export function codingPlanMonth(plan: keyof typeof F.CLAUDE_WEEKLY_HOURS) {
  const hours = F.CLAUDE_WEEKLY_HOURS[plan] * F.WEEKS_PER_MONTH;
  const m = aiMonthCost(hours * F.WH_PER_CLAUDE_CODE_HOUR);
  return { hours, ...m, charged: recurringPrice(m.donation, "monthly") };
}

/** Seconds of healthy life, for amounts of air pollution damage too small for minutes. */
export const lifeSeconds = (usdDamage: number) => usdDamage * F.MINUTES_OF_LIFE_PER_DAMAGE_USD * 60;

/** Sources the question pages cite. Each is also listed on the method page (a test checks). */
export const SOURCES = {
  epoch: { name: "Epoch AI", url: "https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use" },
  patterson: { name: "Patterson et al. 2022", url: "https://arxiv.org/abs/2204.05149" },
  avert: { name: "EPA AVERT", url: "https://www.epa.gov/avert" },
  google: { name: "Google's 2025 measurements of Gemini", url: "https://cloud.google.com/blog/products/infrastructure/measuring-the-environmental-impact-of-ai-inference" },
  li: { name: "Li et al., Making AI Less Thirsty", url: "https://arxiv.org/html/2304.03271v4" },
  iea: { name: "the IEA", url: "https://www.iea.org/commentaries/the-carbon-footprint-of-streaming-video-fact-checking-the-headlines" },
} as const;
