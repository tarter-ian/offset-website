// What the Offset extension reads for each AI service, shown next to the
// Connect buttons and on the Your data page. If the extension starts reading
// more, this text has to change first.

export const SIGN_IN_READS = {
  chatgpt: "How many prompts, reasoning answers and images you made each day for the last 30 days, and your plan. Never your chats.",
  claude: "How many prompts you sent each day for the last 30 days, your plan, and how much of its weekly limit you've used. Never your chats.",
  gemini: "How many prompts you sent each day for the last 30 days. Never your chats.",
  youtube: "How many videos and Shorts you watched each day for the last 30 days, and roughly how long. Never which videos.",
  netflix: "How many episodes and films were started each day for the last 30 days on the profile you're using. Never which ones.",
  amazon: "How many orders you placed each day for the last 30 days, and how many items. Never what you bought, prices or your address.",
  uber: "How many rides you took each day for the last 30 days, with their miles and minutes, and your rides per month back to your first. Never where you went, drivers or prices.",
  doordash: "How many orders you placed each day for the last 30 days, which were delivered or picked up, how many items, and your orders per month back to your first. Never restaurants, items, prices or your address.",
  ubereats: "How many orders you placed each day for the last 30 days, which were delivered or picked up, how many items, and your orders per month back to your first. Never restaurants, items, prices or your address.",
} as const;

export type SignInService = keyof typeof SIGN_IN_READS;
