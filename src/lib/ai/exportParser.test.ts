import { describe, expect, it } from "vitest";
import { countPrompts, summarize } from "./exportParser";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 1);

describe("countPrompts", () => {
  it("counts only user messages in a ChatGPT export", () => {
    const data = [
      {
        mapping: {
          a: { message: { author: { role: "user" }, create_time: now / 1000 - 60 } },
          b: { message: { author: { role: "assistant" }, create_time: now / 1000 - 30 } },
          c: { message: null },
          d: { message: { author: { role: "user" }, create_time: null } },
        },
      },
    ];
    expect(countPrompts(data)).toEqual({ provider: "chatgpt", times: [now - 60_000] });
  });

  it("counts only human messages in a Claude export", () => {
    const data = [
      {
        chat_messages: [
          { sender: "human", created_at: new Date(now - DAY).toISOString() },
          { sender: "assistant", created_at: new Date(now - DAY).toISOString() },
          { sender: "human", created_at: "not a date" },
        ],
      },
    ];
    expect(countPrompts(data)?.times).toEqual([now - DAY]);
  });

  it("rejects files it doesn't recognize", () => {
    expect(countPrompts({ foo: 1 })).toBeNull();
    expect(countPrompts([{ foo: 1 }])).toBeNull();
  });
});

describe("summarize", () => {
  it("averages over the window and ignores older prompts", () => {
    const times = [now - 200 * DAY, ...Array.from({ length: 90 }, (_, i) => now - i * DAY - 1000)];
    const s = summarize([{ provider: "chatgpt", times }], now, 90);
    expect(s.promptsPerDay).toBeCloseTo(1, 1);
    expect(s.totalPrompts).toBe(91);
  });

  it("averages over a short export's own span", () => {
    const times = Array.from({ length: 20 }, (_, i) => now - (i % 10) * DAY);
    expect(summarize([{ provider: "claude", times }], now).promptsPerDay).toBeCloseTo(2.22, 1);
  });

  it("combines providers", () => {
    const s = summarize(
      [
        { provider: "chatgpt", times: [now - DAY] },
        { provider: "claude", times: [now - DAY] },
      ],
      now,
    );
    expect(s.providers).toEqual(["chatgpt", "claude"]);
  });
});
