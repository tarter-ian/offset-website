import { describe, expect, it } from "vitest";
import { levelForPlan } from "./levels";
import { reclaimAiPlan } from "../reclaim";

describe("quick AI estimates", () => {
  it("maps plans to usage levels", () => {
    expect(levelForPlan("free")).toBe("light");
    expect(levelForPlan("ChatGPT Plus")).toBe("medium");
    expect(levelForPlan("pro")).toBe("heavy");
    expect(levelForPlan("max_5x")).toBe("heavy");
    expect(levelForPlan("claude_pro")).toBe("medium");
  });

  it("reads the plan from a sign-in's proven fields or public data", () => {
    expect(reclaimAiPlan({ userId: "u1", membershipTier: "plus" })).toEqual({ plan: "plus", level: "medium" });
    expect(reclaimAiPlan({ userId: "u1" }, JSON.stringify({ tier: "free" }))).toEqual({ plan: "free", level: "light" });
    expect(reclaimAiPlan({ userId: "u1" })).toBeNull();
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
