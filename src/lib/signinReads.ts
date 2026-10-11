// What each sign-in reads, shown next to its button and on the Your data page.
// Keep in step with the Reclaim providers: if a provider starts reading more,
// this text has to change first.

export const RECLAIM_URL = "https://reclaimprotocol.org";

export const SIGN_IN_READS = {
  chatgpt: "How many prompts, reasoning answers and images you made each day for the last 30 days, and your plan. Never your chats.",
  claude: "How many prompts you sent each day for the last 30 days, your plan, and how much of its weekly limit you've used. Never your chats.",
  gemini: "How many prompts you sent each day for the last 30 days. Never your chats.",
  youtube: "How many videos and Shorts you watched each day. Not which ones.",
  netflix: "The titles and dates in your viewing activity, which we turn into hours of video and then discard.",
  spotify: "Your recently played songs (about the last 50), to estimate listening time.",
  uber: "Your recent trips, to count miles by car.",
} as const;

export type SignInService = keyof typeof SIGN_IN_READS;
