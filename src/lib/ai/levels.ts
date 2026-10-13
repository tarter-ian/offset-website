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
 *
 * Images and videos a week. Google reported 50 billion Nano Banana images by
 * May 2026, up from 5 billion in mid-October 2025: about 1.5 a week for each of
 * Gemini's 900 million monthly users, an average pulled up by heavy users, so
 * most people make none. Medium sits just above that average; heavy is our
 * estimate. AI video is still rare and one clip outweighs weeks of chat, so no
 * level includes it; people who make videos add them on the video card (Ian, 2026-10-13).
 */
export const AI_LEVELS: Record<AiLevel, { label: string; promptsPerDay: number; imagesPerWeek: number; videosPerWeek: number; who: string }> = {
  light: { label: "Light", promptsPerDay: 3, imagesPerWeek: 0, videosPerWeek: 0, who: "a few questions a day, like most people" },
  medium: { label: "Medium", promptsPerDay: 10, imagesPerWeek: 2, videosPerWeek: 0, who: "every day, for work or school" },
  heavy: { label: "Heavy", promptsPerDay: 40, imagesPerWeek: 10, videosPerWeek: 0, who: "hours a day, long chats" },
};

/**
 * The level these AI amounts are exactly, if any, so a level shows as picked only
 * when tapping it would change nothing (Ian, 2026-10-13). Picking a level sets coding to none.
 */
export function levelOf(a: { promptsPerDay: number; imagesPerWeek: number; videosPerWeek: number; codingHoursPerWeek: number }): AiLevel | null {
  if (a.codingHoursPerWeek !== 0) return null;
  const hit = (Object.keys(AI_LEVELS) as AiLevel[]).find(
    (k) => AI_LEVELS[k].promptsPerDay === a.promptsPerDay && AI_LEVELS[k].imagesPerWeek === a.imagesPerWeek && AI_LEVELS[k].videosPerWeek === a.videosPerWeek,
  );
  return hit ?? null;
}

/** Maps a subscription name like "ChatGPT Plus", "pro", "max_5x" or "free" to a usage level. */
export function levelForPlan(plan: string): AiLevel {
  const p = plan.toLowerCase();
  if (/\b(pro|max|team|enterprise|business|ultra)\b|max_|_max/.test(p)) return "heavy";
  if (/free|none|inactive|basic/.test(p)) return "light";
  return "medium";
}
