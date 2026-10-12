import { describe, expect, it } from "vitest";
import { levelForPlan } from "./levels";

describe("quick AI estimates", () => {
  it("maps plans to usage levels", () => {
    expect(levelForPlan("free")).toBe("light");
    expect(levelForPlan("ChatGPT Plus")).toBe("medium");
    expect(levelForPlan("pro")).toBe("heavy");
    expect(levelForPlan("max_5x")).toBe("heavy");
    expect(levelForPlan("claude_pro")).toBe("medium");
  });
});

describe("AI sign-in counts", async () => {
  const { signInUsage, summaryFromSignIn } = await import("./signin");
  it("reads the counts and turns them into a 30-day summary", () => {
    const u = signInUsage(JSON.stringify({ prompts: 300, reasoningResponses: 30, images: 12, conversations: 40, planType: "plus", daily: [] }))!;
    expect(u).toMatchObject({ prompts: 300, reasoningResponses: 30, images: 12, days: 30, planType: "plus" });
    const s = summaryFromSignIn("chatgpt", u);
    expect(s.promptsPerDay).toBe(10);
    expect(s.imagesPerWeek).toBeCloseTo(2.8, 6);
    expect(s.reasoningShare).toBeCloseTo(0.1, 6);
    expect(s.totalWh).toBeUndefined();
    expect(signInUsage({ planType: "plus" })).toBeNull();
  });
});

describe("Claude usage limit", async () => {
  const { claudeLimitWhPerDay, claudeWeeklyHours, signInUsage, summaryFromSignIn } = await import("./signin");
  it("estimates Claude Code energy from the share of the weekly limit used", () => {
    expect(claudeWeeklyHours("default_claude_max_5x")).toBe(140);
    expect(claudeWeeklyHours("default_claude_max_20x")).toBe(240);
    expect(claudeWeeklyHours("free")).toBe(0);
    const u = signInUsage({ prompts: 73, reasoningResponses: 0, images: 0, windowDays: 30, rateLimitTier: "default_claude_max_5x", weeklyLimitUsedPercent: 63 })!;
    expect(claudeLimitWhPerDay(u)).toBeCloseTo((0.63 * 140 * 120) / 7, 6);
    expect(summaryFromSignIn("claude", u).whPerDay).toBeCloseTo(claudeLimitWhPerDay(u), 6);
    const code = summaryFromSignIn("claude", u).code!;
    expect(code).toMatchObject({ limitPercent: 63, plan: "Max 5x" });
    expect(code.whPerDay).toBeCloseTo(claudeLimitWhPerDay(u) - (73 * 0.3) / 30, 6);
  });
});

describe("Gemini sign-in", async () => {
  const { signInUsage, summaryFromSignIn } = await import("./signin");
  it("counts prompts from Gemini Apps Activity", () => {
    const u = signInUsage({ prompts: 8, activeDays: 1, truncated: false, daily: [{ date: "2026-10-02", prompts: 8 }] })!;
    expect(summaryFromSignIn("gemini", u).promptsPerDay).toBeCloseTo(8 / 30, 6);
  });

  it("marks a count with unread chats as incomplete", async () => {
    const { signInUsage } = await import("./signin");
    expect(signInUsage({ prompts: 30, failedConversations: 38 })!.missedChats).toBe(38);
    expect(signInUsage({ prompts: 30, truncated: true })!.missedChats).toBe(-1);
    expect(signInUsage({ prompts: 1611, failedConversations: 0, truncated: false })!.missedChats).toBeUndefined();
  });
});

describe("chat history", async () => {
  const { signInUsage, summaryFromSignIn } = await import("./signin");
  const { combineSummaries } = await import("./exportParser");
  const F = await import("../factors");
  const usage = { prompts: 300, reasoningResponses: 0, images: 0, conversations: 30, windowDays: 30 };

  it("prices each older chat at the window's energy per chat", () => {
    const u = signInUsage({ ...usage, history: { chats: 130, chatsBeforeWindow: 100, complete: true, months: {} } })!;
    const s = summaryFromSignIn("chatgpt", u);
    const windowWh = 300 * F.WH_PER_AI_PROMPT;
    expect(s.totalWh).toBeCloseTo(windowWh + 100 * (windowWh / 30), 6);
  });

  it("has no total without history, and estimates the unlinked part when combined", () => {
    const plain = summaryFromSignIn("gemini", signInUsage(usage)!);
    expect(plain.totalWh).toBeUndefined();
    const withHistory = summaryFromSignIn("chatgpt", signInUsage({ ...usage, history: { chats: 30, chatsBeforeWindow: 0, complete: true } })!);
    const all = combineSummaries([withHistory, plain])!;
    expect(all.totalWh).toBeGreaterThan(withHistory.totalWh!);
  });
});
