import { describe, expect, it } from "vitest";
import { digitalFromExport, parseExport, summarize } from "./exportParser";
import { WH_PER_AI_PROMPT } from "../factors";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 1);
const s = now / 1000;
const words = (n: number) => "word ".repeat(n);

const gpt = (msgs: { role: string; t: number; text: string; slug?: string; name?: string; parts?: unknown[] }[]) => ({
  mapping: Object.fromEntries(
    msgs.map((m, i) => [
      `n${i}`,
      {
        message: {
          author: { role: m.role, name: m.name },
          create_time: m.t,
          content: { content_type: "text", parts: m.parts ?? [m.text] },
          metadata: { model_slug: m.slug },
        },
      },
    ]),
  ),
});

describe("parseExport", () => {
  it("counts only user prompts in a ChatGPT export, in time order", () => {
    const data = [
      gpt([
        { role: "assistant", t: s - 30, text: "hi" },
        { role: "user", t: s - 60, text: "hello" },
      ]),
      { mapping: { c: { message: null }, d: { message: { author: { role: "user" }, create_time: null } } } },
    ];
    const u = parseExport(data)!;
    expect(u.provider).toBe("chatgpt");
    expect(u.turns.map((t) => t.time)).toEqual([now - 60_000]);
    expect(u.turns[0].wh).toBeGreaterThan(0);
  });

  it("charges long conversations more, since each turn re-reads the chat", () => {
    const short = parseExport([gpt([{ role: "user", t: s - 100, text: "hi" }, { role: "assistant", t: s - 99, text: words(400) }])])!;
    const long = parseExport([
      gpt(
        Array.from({ length: 40 }, (_, i) => ({
          role: i % 2 ? "assistant" : "user",
          t: s - 1000 + i,
          text: words(400),
        })),
      ),
    ])!;
    const avg = (u: typeof long) => u.turns.reduce((a, t) => a + t.wh, 0) / u.turns.length;
    expect(avg(short)).toBeCloseTo(WH_PER_AI_PROMPT, 0);
    expect(avg(long)).toBeGreaterThan(avg(short) * 5);
  });

  it("charges reasoning models for hidden thinking", () => {
    const reply = (slug: string) =>
      parseExport([gpt([{ role: "user", t: s - 10, text: "q" }, { role: "assistant", t: s - 9, text: words(400), slug }])])!.turns[0];
    expect(reply("o3").reasoning).toBe(true);
    expect(reply("o3").wh).toBeGreaterThan(reply("gpt-4o").wh * 3);
  });

  it("counts images ChatGPT made", () => {
    const u = parseExport([
      gpt([
        { role: "user", t: s - 10, text: "draw a cat" },
        { role: "tool", t: s - 9, text: "", name: "dalle.text2im", parts: [{ content_type: "image_asset_pointer" }] },
      ]),
    ])!;
    expect(u.images).toEqual([(s - 9) * 1000]);
  });

  it("reads a Claude export, including thinking when present", () => {
    const data = [
      {
        chat_messages: [
          { sender: "human", created_at: new Date(now - DAY).toISOString(), text: "hi" },
          {
            sender: "assistant",
            created_at: new Date(now - DAY).toISOString(),
            content: [
              { type: "thinking", thinking: words(2000) },
              { type: "text", text: "hello" },
            ],
          },
          { sender: "human", created_at: "not a date", text: "x" },
        ],
      },
    ];
    const u = parseExport(data)!;
    expect(u.provider).toBe("claude");
    expect(u.turns.map((t) => t.time)).toEqual([now - DAY]);
    expect(u.turns[0].wh).toBeGreaterThan(1);
  });

  it("rejects files it doesn't recognize", () => {
    expect(parseExport({ foo: 1 })).toBeNull();
    expect(parseExport([{ foo: 1 }])).toBeNull();
  });
});

describe("summarize", () => {
  const turn = (daysAgo: number, wh = 1) => ({ time: now - daysAgo * DAY, wh, reasoning: false });

  it("averages over the last 90 days", () => {
    const sum = summarize([{ provider: "chatgpt", turns: [turn(1), turn(10), turn(200)], images: [] }], now);
    expect(sum.totalPrompts).toBe(3);
    expect(sum.windowDays).toBe(10);
    expect(sum.promptsPerDay).toBeCloseTo(0.2, 6);
    expect(sum.whPerDay).toBeCloseTo(0.2, 6);
  });

  it("caps the window at 90 days and combines providers", () => {
    const sum = summarize(
      [
        { provider: "chatgpt", turns: Array.from({ length: 90 }, (_, i) => turn(i + 0.5)), images: [now - DAY] },
        { provider: "claude", turns: [turn(5)], images: [] },
      ],
      now,
    );
    expect(sum.windowDays).toBe(90);
    expect(sum.promptsPerDay).toBeCloseTo(91 / 90, 6);
    expect(sum.imagesPerWeek).toBeCloseTo(7 / 90, 6);
    expect(sum.providers).toEqual(["chatgpt", "claude"]);
  });

  it("turns a summary into answers with energy per prompt", () => {
    const d = digitalFromExport(summarize([{ provider: "claude", turns: [turn(1, 3), turn(2, 1)], images: [] }], now));
    expect(d.aiFromExport).toBe(true);
    expect(d.aiWhPerPrompt).toBeCloseTo(2, 6);
  });
});
