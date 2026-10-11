// Quick AI estimates for people who don't want to download an export: a
// light / medium / heavy pick, or the plan read from a ChatGPT, Claude or
// Perplexity sign-in. Both are estimates; the export is the measurement.

export type AiLevel = "light" | "medium" | "heavy";

/**
 * Prompts a day. Light is about the average ChatGPT user: OpenAI reported
 * about 2.5 billion prompts a day from roughly 800 million weekly users in
 * 2025. Medium and heavy are rough steps up for daily and all-day users.
 */
export const AI_LEVELS: Record<AiLevel, { label: string; promptsPerDay: number; who: string }> = {
  light: { label: "Light", promptsPerDay: 3, who: "a few questions a day" },
  medium: { label: "Medium", promptsPerDay: 15, who: "most days, for work or school" },
  heavy: { label: "Heavy", promptsPerDay: 50, who: "all day, long chats" },
};

/** Maps a subscription name like "ChatGPT Plus", "pro", "max_5x" or "free" to a usage level. */
export function levelForPlan(plan: string): AiLevel {
  const p = plan.toLowerCase();
  if (/\b(pro|max|team|enterprise|business|ultra)\b|max_|_max/.test(p)) return "heavy";
  if (/free|none|inactive|basic/.test(p)) return "light";
  return "medium";
}
