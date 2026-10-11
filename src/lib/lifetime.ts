import * as F from "./factors";
import { computeFootprint, DEFAULT_ANSWERS, IMPACT_KEYS, type Answers, type Impacts } from "./footprint";
import { impactCost, LIFETIME_FEE_USD, LIFETIME_GROWTH_BUFFER, LIFETIME_MIN_DONATION_USD } from "./pricing";

// A one-time offset for everything someone has done and will do online.
// Past years count at today's rate. Future internet use counts at today's rate,
// on the view that efficiency gains in networks and data centers roughly keep
// pace with growing use; future AI use is multiplied by the growth buffer.

export interface LifetimeInput {
  birthYear: number;
  streamingHoursPerDay: number;
  aiPromptsPerDay: number;
  aiMediaPerWeek: number;
  aiFromExport?: boolean;
}

export type LifetimeCover = "internet" | "ai" | "both";

export const LIFETIME_COVERS: Record<LifetimeCover, { label: string; badge: string }> = {
  ai: { label: "AI", badge: "AI" },
  internet: { label: "Internet", badge: "Internet" },
  both: { label: "Both", badge: "Internet + AI" },
};

export interface LifetimePart {
  impacts: Impacts;
  /** Unrounded donation for this part alone. */
  cost: number;
}

export interface LifetimeOffset {
  cover: LifetimeCover;
  parts: { internet: LifetimePart; ai: LifetimePart };
  pastYears: { internet: number; ai: number };
  futureYears: number;
  /** Total impacts covered, estimate plus margin and buffer. */
  impacts: Impacts;
  donation: number;
  fee: number;
  total: number;
}

const add = (a: Impacts, b: Impacts, k = 1): Impacts =>
  Object.fromEntries(IMPACT_KEYS.map((x) => [x, a[x] + b[x] * k])) as Impacts;
const zero: Impacts = { carbon: 0, air: 0, water: 0, land: 0 };

export function lifetimeOffset(input: LifetimeInput, cover: LifetimeCover = "both", now = new Date()): LifetimeOffset {
  const year = now.getFullYear() + now.getMonth() / 12;
  const birth = Math.min(Math.max(input.birthYear || 1990, 1900), year);
  const onlineSince = Math.max(birth + F.ONLINE_FROM_AGE, F.INTERNET_START_YEAR);
  const pastInternet = Math.max(0, year - onlineSince);
  const pastAi = Math.max(0, year - Math.max(F.AI_START_YEAR, onlineSince));
  const futureYears = Math.max(0, birth + F.LIFETIME_TO_AGE - year);

  const answers: Answers = {
    ...DEFAULT_ANSWERS,
    digital: {
      aiPromptsPerDay: input.aiPromptsPerDay,
      aiMediaPerWeek: input.aiMediaPerWeek,
      streamingHoursPerDay: input.streamingHoursPerDay,
      aiFromExport: input.aiFromExport,
    },
  };
  const cats = computeFootprint(answers).categories;
  const internetMonth = cats.find((c) => c.key === "streaming")!.offset;
  const aiMonth = cats.find((c) => c.key === "ai")!.offset;
  const internetYear = add(zero, internetMonth, 12 / F.VIDEO_SHARE_OF_INTERNET);
  const aiYear = add(zero, aiMonth, 12);

  const internet = add(add(zero, internetYear, pastInternet), internetYear, futureYears);
  const ai = add(add(zero, aiYear, pastAi), aiYear, futureYears * LIFETIME_GROWTH_BUFFER);
  const part = (impacts: Impacts): LifetimePart => {
    const c = impactCost(impacts, "expected");
    return { impacts, cost: c.carbon + c.air + c.water + c.land };
  };
  const parts = { internet: part(internet), ai: part(ai) };

  const impacts = cover === "both" ? add(internet, ai) : parts[cover].impacts;
  const raw = cover === "both" ? parts.internet.cost + parts.ai.cost : parts[cover].cost;
  const donation = Math.max(LIFETIME_MIN_DONATION_USD, Math.ceil(raw));
  return {
    cover,
    parts,
    pastYears: { internet: pastInternet, ai: pastAi },
    futureYears,
    impacts,
    donation,
    fee: LIFETIME_FEE_USD,
    total: donation + LIFETIME_FEE_USD,
  };
}
