// Quick AI estimates for people who don't want to download an export: a
// light / medium / heavy pick, or the plan read from a ChatGPT, Claude or
// Perplexity sign-in. Both are estimates; the export is the measurement.

export type AiLevel = "light" | "medium" | "heavy";

/**
 * Prompts a day. ChatGPT handled about 2.5 billion prompts a day from about
 * 700 million weekly users in July 2025 (OpenAI via TechCrunch), about 3.6 a
 * day per weekly user: light. Spread over daily users only (not published;
 * estimates run 200 to 350 million) it's about 7 to 12: medium. Heavy is
 * our estimate for people who use it for hours a day; Pew (2026) found 8% of
 * chatbot users use one almost constantly and Menlo Ventures (2026) found 10%
 * spend over two hours a day.
 */
export const AI_LEVELS: Record<AiLevel, { label: string; promptsPerDay: number; who: string }> = {
  light: { label: "Light", promptsPerDay: 3, who: "a few questions a day, like most people" },
  medium: { label: "Medium", promptsPerDay: 10, who: "every day, for work or school" },
  heavy: { label: "Heavy", promptsPerDay: 40, who: "hours a day, long chats" },
};

/** Maps a subscription name like "ChatGPT Plus", "pro", "max_5x" or "free" to a usage level. */
export function levelForPlan(plan: string): AiLevel {
  const p = plan.toLowerCase();
  if (/\b(pro|max|team|enterprise|business|ultra)\b|max_|_max/.test(p)) return "heavy";
  if (/free|none|inactive|basic/.test(p)) return "light";
  return "medium";
}
