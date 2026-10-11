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
  });
});

describe("Gemini sign-in", async () => {
  const { signInUsage, summaryFromSignIn } = await import("./signin");
  it("counts prompts from Gemini Apps Activity", () => {
    const u = signInUsage({ prompts: 8, activeDays: 1, truncated: false, daily: [{ date: "2026-10-02", prompts: 8 }] })!;
    expect(summaryFromSignIn("gemini", u).promptsPerDay).toBeCloseTo(8 / 30, 6);
  });
});
