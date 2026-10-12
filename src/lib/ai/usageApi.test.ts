import { describe, expect, it } from "vitest";
import { fetchApiUsage, tokensToWh, UsageApiError } from "./usageApi";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 1);

/** A fake fetch that answers by URL and records what it was asked. */
function fakeFetch(routes: Record<string, unknown[]>, status = 200) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const counters: Record<string, number> = {};
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers as Record<string, string> });
    const route = Object.keys(routes).find((r) => url.includes(r))!;
    const i = (counters[route] = (counters[route] ?? -1) + 1);
    return new Response(JSON.stringify(routes[route][i]), { status });
  }) as typeof fetch;
  return { impl, calls };
}

describe("tokensToWh", () => {
  it("charges cached input a tenth of fresh input", () => {
    expect(tokensToWh({ input: 0, cachedInput: 10_000, output: 0 })).toBeCloseTo(
      tokensToWh({ input: 1_000, cachedInput: 0, output: 0 }),
      9,
    );
  });
});

describe("fetchApiUsage", () => {
  it("reads OpenAI completions across pages, plus images", async () => {
    const t = (daysAgo: number) => Math.floor((now - daysAgo * DAY) / 1000);
    const { impl, calls } = fakeFetch({
      "usage/completions": [
        {
          data: [{ start_time: t(10), results: [{ input_tokens: 10_000, input_cached_tokens: 0, output_tokens: 500, num_model_requests: 5 }] }],
          has_more: true,
          next_page: "p2",
        },
        {
          data: [{ start_time: t(5), results: [{ input_tokens: 10_000, input_cached_tokens: 0, output_tokens: 500, num_model_requests: 5 }] }],
          has_more: false,
        },
      ],
      "usage/images": [{ data: [{ start_time: t(5), results: [{ images: 2 }] }], has_more: false }],
    });
    const s = await fetchApiUsage("openai-api", "sk-admin-abc", now, impl);
    expect(calls[0].headers.Authorization).toBe("Bearer sk-admin-abc");
    expect(calls[1].url).toContain("page=p2");
    expect(s.windowDays).toBe(10);
    expect(s.promptsPerDay).toBeCloseTo(1, 6);
    expect(s.whPerDay).toBeCloseTo((2 * tokensToWh({ input: 10_000, cachedInput: 0, output: 500 })) / 10, 6);
    expect(s.imagesPerWeek).toBeCloseTo(1.4, 6);
  });

  it("reads Anthropic usage, counting cache writes as input", async () => {
    const { impl, calls } = fakeFetch({
      usage_report: [
        {
          data: [
            {
              starting_at: new Date(now - 3 * DAY).toISOString(),
              results: [
                {
                  uncached_input_tokens: 1000,
                  cache_read_input_tokens: 2000,
                  cache_creation: { ephemeral_5m_input_tokens: 500, ephemeral_1h_input_tokens: 0 },
                  output_tokens: 300,
                },
              ],
            },
            { starting_at: new Date(now - 2 * DAY).toISOString(), results: [] },
          ],
          has_more: false,
        },
      ],
    });
    const s = await fetchApiUsage("anthropic-api", "sk-ant-admin01-x", now, impl);
    expect(calls[0].headers["x-api-key"]).toBe("sk-ant-admin01-x");
    expect(s.windowDays).toBe(3);
    expect(s.whPerDay).toBeCloseTo(tokensToWh({ input: 1500, cachedInput: 2000, output: 300 }) / 3, 6);
  });

  it("rejects keys of the wrong kind before calling anyone", async () => {
    const { impl, calls } = fakeFetch({});
    await expect(fetchApiUsage("openai-api", "sk-proj-123", now, impl)).rejects.toBeInstanceOf(UsageApiError);
    expect(calls).toHaveLength(0);
  });

  it("explains a rejected key", async () => {
    const { impl } = fakeFetch({ usage_report: [{}] }, 401);
    await expect(fetchApiUsage("anthropic-api", "sk-ant-admin01-x", now, impl)).rejects.toMatchObject({ status: 401 });
  });
});
