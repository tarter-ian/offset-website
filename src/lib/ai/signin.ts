import * as F from "../factors";
import type { AiProvider, UsageSummary } from "./exportParser";

/**
 * What our ChatGPT and Claude sign-ins report: counts over the last 30 days,
 * collected in the person's browser after they log in. No titles or text.
 */
export interface SignInUsage {
  prompts: number;
  reasoningResponses: number;
  images: number;
  days: number;
  planType?: string;
}

const count = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Reads the counts out of a sign-in's public data, or null if it has none. */
export function signInUsage(data: unknown): SignInUsage | null {
  let d = data;
  if (typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      return null;
    }
  }
  if (typeof d !== "object" || d === null || !("prompts" in d)) return null;
  const r = d as Record<string, unknown>;
  const plan = [r.planType, r.rateLimitTier].find((v) => typeof v === "string") as string | undefined;
  const days = count(r.windowDays) || 30;
  return { prompts: count(r.prompts), reasoningResponses: count(r.reasoningResponses), images: count(r.images), days, planType: plan };
}

/**
 * Turns sign-in counts into the same summary an export gives. Without token
 * counts, each prompt is a typical one, and a reasoning answer is weighted the
 * way reasoning output is in exports.
 */
export function summaryFromSignIn(provider: AiProvider, u: SignInUsage): UsageSummary {
  const reasoning = Math.min(u.reasoningResponses, u.prompts);
  const wh = (u.prompts - reasoning) * F.WH_PER_AI_PROMPT + reasoning * F.WH_PER_AI_PROMPT * F.REASONING_OUTPUT_MULTIPLIER;
  return {
    providers: [provider],
    totalPrompts: u.prompts,
    promptsPerDay: u.prompts / u.days,
    whPerDay: wh / u.days,
    imagesPerWeek: (u.images / u.days) * 7,
    reasoningShare: u.prompts ? reasoning / u.prompts : 0,
    windowDays: u.days,
  };
}
