import * as F from "../factors";
import type { UsageSummary } from "./exportParser";

// Reads token usage for an OpenAI or Anthropic API organization with an admin
// key, so developers get measured numbers instead of estimates. Runs on our
// server for one request; the key is never stored or logged.

export type ApiProvider = "openai-api" | "anthropic-api";

export const API_PROVIDERS: Record<ApiProvider, { name: string; keyPrefix: string; keyHelp: string; keyUrl: string }> = {
  "openai-api": {
    name: "OpenAI API",
    keyPrefix: "sk-admin-",
    keyHelp: "an Admin key from your OpenAI organization settings",
    keyUrl: "https://platform.openai.com/settings/organization/admin-keys",
  },
  "anthropic-api": {
    name: "Anthropic API",
    keyPrefix: "sk-ant-admin",
    keyHelp: "an Admin key from the Claude Console",
    keyUrl: "https://console.anthropic.com/settings/admin-keys",
  },
};

export const WINDOW_DAYS = 90;
const MAX_PAGES = 10;
const DAY = 86_400_000;

/** Energy for one bucket of tokens. Reasoning and thinking tokens are already in the output count. */
export function tokensToWh(t: { input: number; cachedInput: number; output: number }): number {
  return (
    t.input * F.WH_PER_INPUT_TOKEN +
    t.cachedInput * F.WH_PER_INPUT_TOKEN * F.CACHED_INPUT_SHARE +
    t.output * F.WH_PER_OUTPUT_TOKEN
  );
}

export class UsageApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

interface Day {
  start: number;
  requests: number;
  wh: number;
  images: number;
}

type Fetch = typeof fetch;

async function getJson(fetchImpl: Fetch, url: string, headers: Record<string, string>) {
  const res = await fetchImpl(url, { headers, cache: "no-store" });
  if (res.status === 401 || res.status === 403) {
    throw new UsageApiError("That key didn't work. It needs to be an admin key with access to usage.", 401);
  }
  if (!res.ok) throw new UsageApiError("The provider didn't return your usage. Try again in a minute.", 502);
  return res.json();
}

async function pages<T>(fetchImpl: Fetch, first: string, headers: Record<string, string>, read: (body: T) => void) {
  let url: string | null = first;
  for (let i = 0; url && i < MAX_PAGES; i++) {
    const body: { has_more?: boolean; next_page?: string | null } & T = await getJson(fetchImpl, url, headers);
    read(body);
    url = body.has_more && body.next_page ? `${first}&page=${encodeURIComponent(body.next_page)}` : null;
  }
}

async function openAiDays(key: string, now: number, fetchImpl: Fetch): Promise<Day[]> {
  const headers = { Authorization: `Bearer ${key}` };
  const start = Math.floor((now - WINDOW_DAYS * DAY) / 1000);
  const days = new Map<number, Day>();
  const day = (s: number) => days.get(s) ?? days.set(s, { start: s * 1000, requests: 0, wh: 0, images: 0 }).get(s)!;
  type Bucket<R> = { data?: { start_time: number; results?: R[] }[] };
  type Completion = { input_tokens?: number; input_cached_tokens?: number; output_tokens?: number; num_model_requests?: number };

  await pages<Bucket<Completion>>(
    fetchImpl,
    `https://api.openai.com/v1/organization/usage/completions?start_time=${start}&bucket_width=1d&limit=31`,
    headers,
    (b) => {
      for (const bucket of b.data ?? []) {
        for (const r of bucket.results ?? []) {
          const d = day(bucket.start_time);
          const cached = r.input_cached_tokens ?? 0;
          d.requests += r.num_model_requests ?? 0;
          d.wh += tokensToWh({ input: (r.input_tokens ?? 0) - cached, cachedInput: cached, output: r.output_tokens ?? 0 });
        }
      }
    },
  );
  await pages<Bucket<{ images?: number }>>(
    fetchImpl,
    `https://api.openai.com/v1/organization/usage/images?start_time=${start}&bucket_width=1d&limit=31`,
    headers,
    (b) => {
      for (const bucket of b.data ?? []) for (const r of bucket.results ?? []) day(bucket.start_time).images += r.images ?? 0;
    },
  );
  return [...days.values()];
}

async function anthropicDays(key: string, now: number, fetchImpl: Fetch): Promise<Day[]> {
  const headers = { "x-api-key": key, "anthropic-version": "2023-06-01" };
  const start = new Date(now - WINDOW_DAYS * DAY).toISOString().slice(0, 10) + "T00:00:00Z";
  const days: Day[] = [];
  type Result = {
    uncached_input_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
    output_tokens?: number;
  };
  await pages<{ data?: { starting_at: string; results?: Result[] }[] }>(
    fetchImpl,
    `https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=${start}&bucket_width=1d&limit=31`,
    headers,
    (b) => {
      for (const bucket of b.data ?? []) {
        const d: Day = { start: Date.parse(bucket.starting_at), requests: 0, wh: 0, images: 0 };
        for (const r of bucket.results ?? []) {
          const written = (r.cache_creation?.ephemeral_5m_input_tokens ?? 0) + (r.cache_creation?.ephemeral_1h_input_tokens ?? 0);
          d.wh += tokensToWh({
            input: (r.uncached_input_tokens ?? 0) + written,
            cachedInput: r.cache_read_input_tokens ?? 0,
            output: r.output_tokens ?? 0,
          });
        }
        days.push(d);
      }
    },
  );
  return days;
}

/** Reads the last 90 days of usage and averages it over the days since use began. */
export async function fetchApiUsage(
  provider: ApiProvider,
  key: string,
  now = Date.now(),
  fetchImpl: Fetch = fetch,
): Promise<UsageSummary> {
  if (!key.startsWith(API_PROVIDERS[provider].keyPrefix)) {
    throw new UsageApiError(`That doesn't look like ${API_PROVIDERS[provider].keyHelp}.`, 400);
  }
  const days = await (provider === "openai-api" ? openAiDays : anthropicDays)(key, now, fetchImpl);
  const used = days.filter((d) => d.wh > 0 || d.images > 0);
  const earliest = used.length ? Math.min(...used.map((d) => d.start)) : now;
  const span = Math.max(1, Math.min(WINDOW_DAYS, Math.ceil((now - earliest) / DAY)));
  const sum = (k: "requests" | "wh" | "images") => used.reduce((s, d) => s + d[k], 0);
  // Anthropic's report has no request count, so we show energy in short-chat equivalents.
  const requests = provider === "openai-api" ? sum("requests") : sum("wh") / F.WH_PER_AI_PROMPT;
  return {
    providers: [provider],
    totalPrompts: Math.round(requests),
    promptsPerDay: requests / span,
    whPerDay: sum("wh") / span,
    imagesPerWeek: (sum("images") / span) * 7,
    reasoningShare: 0,
    windowDays: span,
  };
}
