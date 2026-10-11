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
