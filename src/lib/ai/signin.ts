import * as F from "../factors";
import type { AiProvider, UsageSummary } from "./exportParser";
import { historyTotal } from "../history";

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
  /** Claude only: share of the plan's weekly limit used, which includes Claude Code. */
  weeklyLimitUsedPercent?: number;
  /**
   * Chats the extension couldn't read (ChatGPT limits how fast chats can be read),
   * or -1 when it stopped early without saying how many. Set means the count is too low.
   */
  missedChats?: number;
  /** Chats with prompts in the window. */
  conversations?: number;
  /** ChatGPT and Claude: every chat the account still has, by when it was started. */
  history?: ChatHistory;
  /** Gemini with a whole-history count: every prompt the activity log still has, and the month it starts. */
  promptsEver?: { total: number; since: string };
  /** ChatGPT's agent and Codex tools: tokens in the window and ever, from the profile page, and which tools they came from. */
  agentTokens?: { window: number; lifetime: number; tool: AgentTool };
}

/** Which of ChatGPT's token-counted tools were used: its own agent, Codex, or both (also when the extension doesn't say). */
export type AgentTool = "agent" | "codex" | "both";

function agentToolOf(agentic: Record<string, unknown>): AgentTool {
  const agent = Number(agentic.agentTokens), codex = Number(agentic.codexTokens);
  if (!Number.isFinite(agent) || !Number.isFinite(codex)) return "both";
  if (agent > 0 && codex <= 0) return "agent";
  if (codex > 0 && agent <= 0) return "codex";
  return "both";
}

/** How the tools are named on the page. */
export const AGENT_TOOL_NAMES: Record<AgentTool, string> = {
  agent: "ChatGPT's agent",
  codex: "Codex",
  both: "ChatGPT's agent and Codex",
};

/** From the extension's chat list: no chat opened, so chats are counted, not prompts. */
export interface ChatHistory {
  firstChat?: string;
  chats: number;
  /** Chats started before the 30-day window. */
  chatsBeforeWindow: number;
  /** False when the list was too long to read to the end. */
  complete: boolean;
}

function chatHistory(v: unknown): ChatHistory | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  const h = v as Record<string, unknown>;
  if (!Number.isFinite(Number(h.chatsBeforeWindow))) return undefined;
  return {
    ...(typeof h.firstChat === "string" ? { firstChat: h.firstChat } : {}),
    chats: count(h.chats),
    chatsBeforeWindow: count(h.chatsBeforeWindow),
    complete: h.complete === true,
  };
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
  const weekly = Number(r.weeklyLimitUsedPercent);
  const history = chatHistory(r.history);
  const ever = history ? null : historyTotal(r, "prompts");
  const agentic = typeof r.agentic === "object" && r.agentic !== null ? (r.agentic as Record<string, unknown>) : null;
  const agentTokens = agentic ? { window: count(agentic.tokens), lifetime: count(agentic.lifetimeTokens), tool: agentToolOf(agentic) } : null;
  return {
    prompts: count(r.prompts),
    reasoningResponses: count(r.reasoningResponses),
    images: count(r.images),
    days,
    planType: plan,
    ...(Number.isFinite(weekly) && weekly > 0 ? { weeklyLimitUsedPercent: Math.min(weekly, 100) } : {}),
    ...("conversations" in r ? { conversations: count(r.conversations) } : {}),
    ...(history ? { history } : {}),
    ...(ever ? { promptsEver: { total: Math.max(ever.total, count(r.prompts)), since: ever.firstMonth } } : {}),
    ...(agentTokens && (agentTokens.window || agentTokens.lifetime) ? { agentTokens } : {}),
    ...(count(r.failedConversations) > 0 ? { missedChats: count(r.failedConversations) } : r.truncated === true ? { missedChats: -1 } : {}),
  };
}

/**
 * Turns sign-in counts into the same summary an export gives. Without token
 * counts, each prompt is a typical one, and a reasoning answer is weighted the
 * way reasoning output is in exports.
 */
export function summaryFromSignIn(provider: AiProvider, u: SignInUsage): UsageSummary {
  const reasoning = Math.min(u.reasoningResponses, u.prompts);
  const wh = (u.prompts - reasoning) * F.WH_PER_AI_PROMPT + reasoning * F.WH_PER_AI_PROMPT * F.REASONING_OUTPUT_MULTIPLIER;
  // Claude Code use only shows in the weekly limit, so use whichever is larger.
  const fromLimit = claudeLimitWhPerDay(u);
  // ChatGPT's agent and Codex tools, which chat counts don't see.
  const agentWh = (tokens: number) => (tokens / 1e6) * F.WH_PER_MILLION_AGENT_TOKENS;
  const agentPerDay = u.agentTokens ? agentWh(u.agentTokens.window) / u.days : 0;
  return {
    providers: [provider],
    totalPrompts: u.prompts,
    promptsPerDay: u.prompts / u.days,
    whPerDay: Math.max(wh / u.days, fromLimit) + agentPerDay,
    ...(u.agentTokens ? { agent: { whPerDay: agentPerDay, lifetimeWh: agentWh(u.agentTokens.lifetime), lifetimeTokens: u.agentTokens.lifetime, tool: u.agentTokens.tool } } : {}),
    ...(fromLimit > wh / u.days
      ? { code: { whPerDay: fromLimit - wh / u.days, limitPercent: u.weeklyLimitUsedPercent ?? 0, plan: claudePlanName(u.planType) } }
      : {}),
    imagesPerWeek: (u.images / u.days) * 7,
    reasoningShare: u.prompts ? reasoning / u.prompts : 0,
    windowDays: u.days,
    // Chat only: coding to date is in `code` and `agent`, and goes on the coding card.
    ...(u.history || u.promptsEver
      ? { totalWh: u.history ? pastWhFromHistory(u, wh) : (u.prompts ? wh / u.prompts : F.WH_PER_AI_PROMPT) * u.promptsEver!.total }
      : {}),
  };
}

/**
 * All-time energy from chat history: the window as measured, plus each older
 * chat at the window's energy per chat (three typical prompts when the window
 * has none). This follows when the person actually used it, chat by chat.
 */
export function pastWhFromHistory(u: SignInUsage, windowWh: number): number {
  const older = u.history?.chatsBeforeWindow ?? 0;
  const perChat = u.conversations ? windowWh / u.conversations : F.AI_PROMPTS_PER_CHAT * F.WH_PER_AI_PROMPT;
  return windowWh + older * perChat;
}

/** Weekly hours of use a Claude plan allows, from its rate-limit tier like "default_claude_max_5x". */
export function claudeWeeklyHours(tier: string | undefined): number {
  const t = (tier ?? "").toLowerCase();
  if (/20x/.test(t)) return F.CLAUDE_WEEKLY_HOURS.max_20x;
  if (/5x|max/.test(t)) return F.CLAUDE_WEEKLY_HOURS.max_5x;
  if (/pro|claude_ai|team/.test(t)) return F.CLAUDE_WEEKLY_HOURS.pro;
  return 0;
}

/** A Claude plan's name as people know it, from its rate-limit tier. */
export function claudePlanName(tier: string | undefined): string {
  const t = (tier ?? "").toLowerCase();
  if (/20x/.test(t)) return "Max 20x";
  if (/5x|max/.test(t)) return "Max 5x";
  return "Pro";
}

/** Daily energy implied by the share of a Claude plan's weekly limit used. */
export function claudeLimitWhPerDay(u: SignInUsage): number {
  if (!u.weeklyLimitUsedPercent) return 0;
  const hours = (u.weeklyLimitUsedPercent / 100) * claudeWeeklyHours(u.planType);
  return (hours * F.WH_PER_CLAUDE_CODE_HOUR) / 7;
}
