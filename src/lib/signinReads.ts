// What the Offset extension reads for each AI service, shown next to the
// Connect buttons and on the Your data page. If the extension starts reading
// more, this text has to change first.

export const SIGN_IN_READS = {
  chatgpt: "How many prompts, reasoning answers and images you made each day for the last 30 days, your plan, and the token totals your profile shows for ChatGPT's agent and Codex tools, but not your chats.",
  claude: "How many prompts you sent each day for the last 30 days, your plan, and how much of its weekly limit you've used, but not your chats.",
  gemini: "How many prompts you sent each day for the last 30 days, but not your chats.",
  youtube: "How many videos and Shorts you watched each day for the last 30 days, and roughly how long, but not which videos.",
  netflix: "How many episodes and films were started each day for the last 30 days on the profile you're using, but not which titles.",
  amazon: "How many orders and items each day for the last 30 days, what each order cost, and what kind of thing each item was (such as electronics or clothing), and your orders and spending per month for three months, or back to your first if you count your whole history. It never sees what you bought, item prices or your address.",
  uber: "How many rides you took each day for the last 30 days, with their miles, minutes and fares, and your rides and fares per month back to your first. It never sees where you went, your routes or your drivers.",
  doordash: "How many orders you placed each day for the last 30 days, which were delivered or picked up, how many items, what each order cost in all, and your orders and totals per month back to your first. It never sees restaurants, items, item prices or your address.",
  ubereats: "How many orders you placed each day for the last 30 days, which were delivered or picked up, how many items, what each order cost in all, and your orders and totals per month back to your first. It never sees restaurants, items, item prices or your address.",
} as const;

export type SignInService = keyof typeof SIGN_IN_READS;
