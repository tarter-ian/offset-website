import { describe, expect, it } from "vitest";
import { monthlyUse, monthTotal, recordStatus } from "./record";

const NOW = Date.parse("2026-10-12T12:00:00Z");

describe("recordStatus", () => {
  it("is none with nothing covered", () => expect(recordStatus({}, NOW)).toEqual({ kind: "none" }));
  it("is life when everything is for life", () => expect(recordStatus({ ai: { kind: "life" } }, NOW)).toEqual({ kind: "life" }));
  it("is covered until the earliest end", () =>
    expect(
      recordStatus({ ai: { kind: "life" }, video: { kind: "period", until: "2026-11-12T00:00:00Z" }, car: { kind: "period", until: "2026-12-01T00:00:00Z" } }, NOW),
    ).toEqual({ kind: "covered", until: "2026-11-12T00:00:00Z" }));
  it("is due when a monthly cover has ended", () =>
    expect(recordStatus({ ai: { kind: "period", until: "2026-10-01T00:00:00Z" }, video: { kind: "period", until: "2026-11-01T00:00:00Z" } }, NOW)).toEqual({
      kind: "due",
      ids: ["ai"],
      ended: "2026-10-01T00:00:00Z",
    }));
  it("never asks to renew what a steady gift keeps paying for", () => {
    const ended = { ai: { kind: "period" as const, until: "2026-10-01T00:00:00Z" } };
    expect(recordStatus(ended, NOW, ["ai"])).toEqual({ kind: "steady" });
    expect(recordStatus({ ...ended, video: { kind: "period", until: "2026-10-02T00:00:00Z" } }, NOW, ["ai"])).toEqual({
      kind: "due",
      ids: ["video"],
      ended: "2026-10-02T00:00:00Z",
    });
    expect(recordStatus({ ...ended, car: { kind: "period", until: "2026-12-01T00:00:00Z" } }, NOW, ["ai"])).toEqual({ kind: "covered", until: "2026-12-01T00:00:00Z" });
  });
  it("never asks to renew someone else's gift", () =>
    expect(recordStatus({ ai: { kind: "period", until: "2026-10-01T00:00:00Z", giftFrom: "Sam" } }, NOW)).toEqual({ kind: "none" }));
});

describe("monthlyUse", () => {
  it("adds prompts per month across services and counts days", () => {
    const m = monthlyUse({
      chatgpt: [
        { date: "2026-09-30", prompts: 10 },
        { date: "2026-10-01", prompts: 20 },
        { date: "2026-10-02", prompts: 5 },
      ],
      claude: [{ date: "2026-10-01", prompts: 7 }, { date: "bad", prompts: 3 }],
    });
    expect(m.map((x) => x.month)).toEqual(["2026-09", "2026-10"]);
    expect(m[1].prompts).toEqual({ chatgpt: 25, claude: 7, gemini: 0 });
    expect(m[1].daysCounted).toBe(2);
    expect(monthTotal(m[1])).toBe(32);
  });
  it("keeps only the last months", () => {
    const rec = Array.from({ length: 12 }, (_, i) => ({ date: `2026-${String(i + 1).padStart(2, "0")}-01`, prompts: 1 }));
    expect(monthlyUse({ chatgpt: rec }, 3).map((x) => x.month)).toEqual(["2026-10", "2026-11", "2026-12"]);
  });
});
