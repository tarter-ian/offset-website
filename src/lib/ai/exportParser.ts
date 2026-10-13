import * as F from "../factors";
import { listZip, readZipText } from "./zipEntry";

// Reads the data export people can download from ChatGPT (Settings > Data
// controls > Export data), Claude (Settings > Privacy > Export data) or Gemini
// (Google Takeout > My Activity > Gemini Apps, in JSON format) and
// measures their use: prompts, how much text each turn read and wrote, which
// model answered, and images made. Everything runs in the browser; the file is
// never uploaded.

export type AiProvider = "chatgpt" | "claude" | "gemini" | "openai-api" | "anthropic-api";

export interface Turn {
  /** When the user sent the prompt (ms). */
  time: number;
  /** Estimated energy to answer it, in Wh, before the training share. */
  wh: number;
  reasoning: boolean;
}

export interface ExportUsage {
  provider: AiProvider;
  turns: Turn[];
  /** Times (ms) of images the AI made. */
  images: number[];
}

export interface CodeEstimate {
  whPerDay: number;
  limitPercent: number;
  plan: string;
}

export interface UsageSummary {
  providers: AiProvider[];
  totalPrompts: number;
  /** Over the last `windowDays`, or over the export's span if shorter. */
  promptsPerDay: number;
  whPerDay: number;
  imagesPerWeek: number;
  /** Share of prompts answered by a reasoning model. */
  reasoningShare: number;
  windowDays: number;
  /** All-time energy of every prompt in the export, in Wh. Missing for API usage, which only covers recent months. */
  totalWh?: number;
  /** Claude Code, estimated from the share of a Claude plan's weekly limit used: the daily energy beyond the counted chats. */
  code?: CodeEstimate;
  /** ChatGPT's agent and Codex tools, from their token counts: already in `whPerDay` and `totalWh`. */
  agent?: { whPerDay: number; lifetimeWh: number; lifetimeTokens: number; tool?: "agent" | "codex" | "both" };
}

type Part = string | { content_type?: string; text?: string } | null;
interface ChatGptMessage {
  author?: { role?: string; name?: string | null };
  create_time?: number | null;
  content?: { content_type?: string; parts?: Part[]; text?: string };
  metadata?: { model_slug?: string | null };
}
interface ChatGptConversation {
  mapping?: Record<string, { message?: ChatGptMessage | null }>;
}
interface ClaudeMessage {
  sender?: string;
  created_at?: string;
  text?: string;
  content?: { type?: string; text?: string; thinking?: string }[];
}
interface ClaudeConversation {
  chat_messages?: ClaudeMessage[];
}
/** One entry of Google Takeout's My Activity, filtered to Gemini Apps. */
interface GeminiActivity {
  header?: string;
  title?: string;
  time?: string;
  products?: string[];
  safeHtmlItem?: { html?: string }[];
}

const isGemini = (a: GeminiActivity) =>
  [a.header ?? "", ...(a.products ?? [])].some((x) => /gemini|bard/i.test(x));
const stripHtml = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ");

const REASONING_SLUG = /^(o\d|gpt-5.*(thinking|pro)|.*reason)/i;
const tokens = (text: string) => text.length / F.CHARS_PER_TOKEN;

/** Walks a conversation in order, charging each reply for re-reading everything before it. */
function measure(
  messages: { role: "user" | "ai"; time: number; text: string; reasoning?: boolean; hiddenText?: string }[],
): Turn[] {
  const turns: Turn[] = [];
  let context = 0;
  let open: Turn | null = null;
  for (const m of messages) {
    const t = tokens(m.text);
    if (m.role === "user") {
      context += t;
      open = { time: m.time, wh: 0, reasoning: false };
      turns.push(open);
    } else if (open) {
      const out = t + tokens(m.hiddenText ?? "");
      open.wh += context * F.WH_PER_INPUT_TOKEN + out * F.WH_PER_OUTPUT_TOKEN * (m.reasoning ? F.REASONING_OUTPUT_MULTIPLIER : 1);
      open.reasoning ||= !!m.reasoning;
      context += t;
    }
  }
  // A turn with no text to measure (no reply, or an export without message text) gets the typical figure.
  for (const t of turns) if (t.wh === 0) t.wh = F.WH_PER_AI_PROMPT;
  return turns;
}

function chatGptText(m: ChatGptMessage): string {
  const c = m.content;
  if (!c) return "";
  if (typeof c.text === "string") return c.text;
  return (c.parts ?? []).map((p) => (typeof p === "string" ? p : (p?.text ?? ""))).join("\n");
}

const isImage = (m: ChatGptMessage) =>
  (m.author?.role === "tool" && /dalle|image/i.test(m.author?.name ?? "")) ||
  (m.content?.parts ?? []).some((p) => typeof p === "object" && p?.content_type === "image_asset_pointer" && m.author?.role !== "user");

/** Measures use in a parsed conversations.json from either service. */
export function parseExport(data: unknown): ExportUsage | null {
  if (!Array.isArray(data)) return null;
  const first = data.find((c) => c && typeof c === "object") as Record<string, unknown> | undefined;
  if (!first) return null;

  if ("mapping" in first) {
    const turns: Turn[] = [];
    const images: number[] = [];
    for (const conv of data as ChatGptConversation[]) {
      const msgs = Object.values(conv.mapping ?? {})
        .map((n) => n.message)
        .filter((m): m is ChatGptMessage => !!m && typeof m.create_time === "number")
        .sort((a, b) => a.create_time! - b.create_time!);
      for (const m of msgs) if (isImage(m)) images.push(m.create_time! * 1000);
      turns.push(
        ...measure(
          msgs
            .filter((m) => m.author?.role === "user" || m.author?.role === "assistant")
            .map((m) => ({
              role: m.author?.role === "user" ? ("user" as const) : ("ai" as const),
              time: m.create_time! * 1000,
              text: chatGptText(m),
              reasoning: REASONING_SLUG.test(m.metadata?.model_slug ?? ""),
            })),
        ),
      );
    }
    return { provider: "chatgpt", turns, images: [...new Set(images)] };
  }

  if ("chat_messages" in first) {
    const turns: Turn[] = [];
    for (const conv of data as ClaudeConversation[]) {
      const msgs = (conv.chat_messages ?? [])
        .map((m) => {
          const time = m.created_at ? Date.parse(m.created_at) : NaN;
          const blocks = m.content ?? [];
          const text = blocks.length
            ? blocks.filter((b) => b.type !== "thinking").map((b) => b.text ?? "").join("\n")
            : (m.text ?? "");
          const thinking = blocks.filter((b) => b.type === "thinking").map((b) => b.thinking ?? b.text ?? "").join("\n");
          return { role: m.sender === "human" ? ("user" as const) : ("ai" as const), time, text, hiddenText: thinking, reasoning: false };
        })
        .filter((m) => Number.isFinite(m.time));
      turns.push(...measure(msgs));
    }
    return { provider: "claude", turns, images: [] };
  }

  // Gemini's activity log lists each prompt on its own, without the conversation
  // around it, so long chats are measured as if every prompt started fresh.
  if ("header" in first || "products" in first) {
    const turns: Turn[] = [];
    for (const a of data as GeminiActivity[]) {
      const time = a.time ? Date.parse(a.time) : NaN;
      if (!isGemini(a) || !Number.isFinite(time) || !/^prompted/i.test(a.title ?? "")) continue;
      const prompt = (a.title ?? "").replace(/^prompted\s*/i, "");
      const reply = (a.safeHtmlItem ?? []).map((h) => stripHtml(h.html ?? "")).join("\n");
      turns.push(
        ...measure([
          { role: "user", time, text: prompt },
          { role: "ai", time, text: reply },
        ]),
      );
    }
    return turns.length ? { provider: "gemini", turns, images: [] } : null;
  }

  return null;
}

/** The file in an export's .zip that holds the chats. */
const isChatsFile = (name: string) => name.endsWith("conversations.json") || (/gemini/i.test(name) && name.endsWith(".json"));

/**
 * Accepts the export's .zip, its conversations.json, or Google Takeout's Gemini MyActivity.json.
 * From a .zip only the chats file is read, so an export of many GB still fits in a phone's memory.
 */
export async function readExportFile(file: Blob & { name: string }): Promise<ExportUsage | null> {
  let text: string;
  if (file.name.toLowerCase().endsWith(".zip")) {
    const entry = (await listZip(file)).find((e) => isChatsFile(e.name));
    if (!entry) return null;
    text = await readZipText(file, entry);
  } else {
    text = await file.text();
  }
  try {
    return parseExport(JSON.parse(text));
  } catch {
    return null;
  }
}

const DAY = 86_400_000;

export function summarize(usage: ExportUsage[], now = Date.now(), windowDays = 90): UsageSummary {
  const turns = usage.flatMap((u) => u.turns).filter((t) => t.time <= now);
  const recent = turns.filter((t) => t.time >= now - windowDays * DAY);
  const images = usage.flatMap((u) => u.images).filter((t) => t <= now && t >= now - windowDays * DAY);
  const earliest = Math.min(now, ...recent.map((t) => t.time), ...images);
  // If the export covers less than the window, average over what it covers.
  const days = Math.max(1, Math.min(windowDays, Math.ceil((now - earliest) / DAY)));
  return {
    providers: [...new Set(usage.map((u) => u.provider))],
    totalPrompts: turns.length,
    promptsPerDay: recent.length / days,
    whPerDay: recent.reduce((s, t) => s + t.wh, 0) / days,
    imagesPerWeek: (images.length / days) * 7,
    reasoningShare: recent.length ? recent.filter((t) => t.reasoning).length / recent.length : 0,
    windowDays: days,
    totalWh: turns.reduce((s, t) => s + t.wh, 0),
  };
}

/** Past energy for a source without history: steady growth from ChatGPT's launch to today's rate. */
export function estimatedPastWh(whPerDay: number, now = new Date()): number {
  const year = now.getUTCFullYear() + now.getUTCMonth() / 12;
  return whPerDay * 365 * Math.max(0, year - F.AI_START_YEAR) * F.AI_PAST_RAMP;
}

/** Adds up use across several linked accounts. */
export function combineSummaries(summaries: UsageSummary[]): UsageSummary | null {
  if (!summaries.length) return null;
  const sum = (k: "promptsPerDay" | "whPerDay" | "imagesPerWeek" | "totalPrompts") => summaries.reduce((s, x) => s + x[k], 0);
  const prompts = sum("promptsPerDay");
  return {
    providers: [...new Set(summaries.flatMap((s) => s.providers))],
    totalPrompts: sum("totalPrompts"),
    promptsPerDay: prompts,
    whPerDay: sum("whPerDay"),
    imagesPerWeek: sum("imagesPerWeek"),
    reasoningShare: prompts ? summaries.reduce((s, x) => s + x.reasoningShare * x.promptsPerDay, 0) / prompts : 0,
    windowDays: Math.max(...summaries.map((s) => s.windowDays)),
    code: summaries.find((s) => s.code)?.code,
    agent: summaries.find((s) => s.agent)?.agent,
    // Known when any linked source has its history; the others grow steadily since ChatGPT's launch.
    totalWh: summaries.some((s) => s.totalWh !== undefined)
      ? summaries.reduce((s, x) => s + (x.totalWh ?? estimatedPastWh(x.whPerDay)), 0)
      : undefined,
  };
}

/** The digital answers an export or linked account fills in. */
export function digitalFromExport(s: UsageSummary, now = new Date()) {
  const promptsPerDay = Math.round(s.promptsPerDay * 10) / 10;
  // Coding (Claude Code through Claude's weekly limit, ChatGPT's agent and Codex) goes on its own card, not into each prompt.
  const codingWhPerDay = (s.code?.whPerDay ?? 0) + (s.agent?.whPerDay ?? 0);
  const chatWhPerDay = Math.max(0, s.whPerDay - codingWhPerDay);
  const codingSince = Math.max(0, now.getFullYear() + now.getMonth() / 12 - F.AI_CODING_START_YEAR);
  return {
    aiPromptsPerDay: promptsPerDay,
    aiWhPerPrompt: s.promptsPerDay > 0 ? chatWhPerDay / s.promptsPerDay : undefined,
    aiCodingHoursPerWeek: Math.round(((codingWhPerDay * 7) / F.WH_PER_CLAUDE_CODE_HOUR) * 2) / 2,
    // ChatGPT's token total covers every agent and Codex run; Claude Code's past grows steadily from 2025 to today's rate.
    aiCodingPastWh:
      s.code || s.agent ? (s.agent?.lifetimeWh ?? 0) + (s.code ? s.code.whPerDay * 365 * codingSince * F.AI_PAST_RAMP : 0) : undefined,
    aiMediaPerWeek: Math.round(s.imagesPerWeek * 10) / 10,
    aiFromExport: true,
    aiPastWh: s.totalWh,
    aiCode: s.code,
    aiAgent: s.agent,
  };
}
