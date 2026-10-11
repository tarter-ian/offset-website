import { unzipSync, strFromU8 } from "fflate";

// Reads the data export people can download from ChatGPT (Settings > Data
// controls > Export data) or Claude (Settings > Privacy > Export data) and
// counts the prompts they sent. Everything runs in the browser; the file is
// never uploaded.

export type AiProvider = "chatgpt" | "claude";

export interface PromptCount {
  provider: AiProvider;
  /** Timestamps (ms) of every prompt the user sent. */
  times: number[];
}

export interface UsageSummary {
  providers: AiProvider[];
  totalPrompts: number;
  /** Prompts per day over the last `windowDays`, or over the export's span if shorter. */
  promptsPerDay: number;
  windowDays: number;
}

interface ChatGptNode {
  message?: { author?: { role?: string }; create_time?: number | null } | null;
}
interface ChatGptConversation {
  mapping?: Record<string, ChatGptNode>;
}
interface ClaudeConversation {
  chat_messages?: { sender?: string; created_at?: string }[];
}

/** Counts user prompts in a parsed conversations.json from either service. */
export function countPrompts(data: unknown): PromptCount | null {
  if (!Array.isArray(data)) return null;
  const first = data.find((c) => c && typeof c === "object") as Record<string, unknown> | undefined;
  if (!first) return null;

  if ("mapping" in first) {
    const times: number[] = [];
    for (const conv of data as ChatGptConversation[]) {
      for (const node of Object.values(conv.mapping ?? {})) {
        const m = node.message;
        if (m?.author?.role === "user" && typeof m.create_time === "number") times.push(m.create_time * 1000);
      }
    }
    return { provider: "chatgpt", times };
  }

  if ("chat_messages" in first) {
    const times: number[] = [];
    for (const conv of data as ClaudeConversation[]) {
      for (const msg of conv.chat_messages ?? []) {
        const t = msg.created_at ? Date.parse(msg.created_at) : NaN;
        if (msg.sender === "human" && Number.isFinite(t)) times.push(t);
      }
    }
    return { provider: "claude", times };
  }

  return null;
}

/** Accepts the export's .zip or its conversations.json. */
export async function readExportFile(file: File): Promise<PromptCount | null> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text: string | undefined;
  if (file.name.toLowerCase().endsWith(".zip")) {
    const entries = unzipSync(bytes, { filter: (f) => f.name.endsWith("conversations.json") });
    const entry = Object.values(entries)[0];
    if (!entry) return null;
    text = strFromU8(entry);
  } else {
    text = strFromU8(bytes);
  }
  try {
    return countPrompts(JSON.parse(text));
  } catch {
    return null;
  }
}

const DAY = 86_400_000;

export function summarize(counts: PromptCount[], now = Date.now(), windowDays = 90): UsageSummary {
  const all = counts.flatMap((c) => c.times).filter((t) => t <= now);
  const recent = all.filter((t) => t >= now - windowDays * DAY);
  const earliest = recent.length ? Math.min(...recent) : now;
  // If the export covers less than the window, average over what it covers.
  const days = Math.max(1, Math.min(windowDays, Math.ceil((now - earliest) / DAY)));
  return {
    providers: [...new Set(counts.map((c) => c.provider))],
    totalPrompts: all.length,
    promptsPerDay: recent.length / days,
    windowDays: days,
  };
}
