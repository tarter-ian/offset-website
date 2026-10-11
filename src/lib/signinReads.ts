// What the Offset extension reads for each AI service, shown next to the
// Connect buttons and on the Your data page. If the extension starts reading
// more, this text has to change first.

export const SIGN_IN_READS = {
  chatgpt: "How many prompts, reasoning answers and images you made each day for the last 30 days, and your plan. Never your chats.",
  claude: "How many prompts you sent each day for the last 30 days, your plan, and how much of its weekly limit you've used. Never your chats.",
  gemini: "How many prompts you sent each day for the last 30 days. Never your chats.",
  youtube: "How many videos and Shorts you watched each day for the last 30 days, and roughly how long. Never which videos.",
} as const;

export type SignInService = keyof typeof SIGN_IN_READS;
