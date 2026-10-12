import { describe, expect, it } from "vitest";
import * as F from "../factors";
import { claudeLimitWhPerDay, summaryFromSignIn } from "./signin";
import { usageFromQuickCount } from "./quickCount";

describe("usageFromQuickCount", () => {
  it("turns chats a week into prompts over 7 days", () => {
    const u = usageFromQuickCount({ chatsPerWeek: 10 });
    expect(u.prompts).toBe(10 * F.PROMPTS_PER_CHAT);
    expect(u.days).toBe(7);
    expect(summaryFromSignIn("chatgpt", u).promptsPerDay).toBeCloseTo((10 * F.PROMPTS_PER_CHAT) / 7, 6);
  });

  it("uses a Claude plan's weekly limit when it's set", () => {
    const u = usageFromQuickCount({ chatsPerWeek: 2, plan: "max_5x", weeklyLimitUsedPercent: 50 });
    expect(claudeLimitWhPerDay(u)).toBeCloseTo((0.5 * F.CLAUDE_WEEKLY_HOURS.max_5x * F.WH_PER_CLAUDE_CODE_HOUR) / 7, 6);
    expect(claudeLimitWhPerDay(usageFromQuickCount({ chatsPerWeek: 2, plan: "free", weeklyLimitUsedPercent: 50 }))).toBe(0);
  });

  it("ignores nonsense", () => {
    expect(usageFromQuickCount({ chatsPerWeek: -3 }).prompts).toBe(0);
    expect(usageFromQuickCount({ chatsPerWeek: 5, weeklyLimitUsedPercent: 250 }).weeklyLimitUsedPercent).toBe(100);
  });
});
