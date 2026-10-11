import * as F from "../factors";
import type { SignInUsage } from "./signin";

// The quick count: numbers people can read off their own app in under a
// minute, for phones and browsers without the Offset extension. Chats in the
// sidebar over the last 7 days, and for Claude the plan and the share of its
// weekly limit used (Settings > Usage), which also covers Claude Code.

export type QuickService = "chatgpt" | "claude" | "gemini";
export type ClaudePlan = "free" | "pro" | "max_5x" | "max_20x";

export const CLAUDE_PLANS: Record<ClaudePlan, string> = {
  free: "Free",
  pro: "Pro",
  max_5x: "Max 5x",
  max_20x: "Max 20x",
};

export interface QuickCount {
  chatsPerWeek: number;
  /** Claude only. */
  plan?: ClaudePlan;
  weeklyLimitUsedPercent?: number;
}

const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

/** Turns a quick count into the same counts a measured sign-in gives, over one week. */
export function usageFromQuickCount(q: QuickCount): SignInUsage {
  const pct = nonNeg(q.weeklyLimitUsedPercent ?? 0);
  return {
    prompts: Math.round(nonNeg(q.chatsPerWeek) * F.PROMPTS_PER_CHAT),
    reasoningResponses: 0,
    images: 0,
    days: 7,
    planType: q.plan,
    ...(pct > 0 ? { weeklyLimitUsedPercent: Math.min(pct, 100) } : {}),
  };
}
