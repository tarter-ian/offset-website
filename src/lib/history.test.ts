import { describe, expect, it } from "vitest";
import { combineVideoPast, historyTotal, monthAsYear, monthName, videoHistoryHours } from "./history";

const yt = { videos: 3, history: { whole: false, monthly: [{ month: "2022-03", videos: 10, hours: 4 }, { month: "2026-09", videos: 50, hours: 20 }, { month: "bad", hours: 99 }] } };
const nf = { titles: 2, history: { whole: true, monthly: [{ month: "2014-10", titles: 3 }, { month: "2026-09", titles: 6 }] } };

describe("whole history", () => {
  it("adds a field over the months and finds where it starts", () => {
    expect(historyTotal(yt, "hours")).toEqual({ total: 24, firstMonth: "2022-03", whole: false });
    expect(historyTotal({ prompts: 3 }, "prompts")).toBeNull();
    expect(historyTotal(yt, "prompts")).toBeNull();
  });
  it("turns Netflix titles into hours and combines services", () => {
    expect(videoHistoryHours("netflix", nf)?.total).toBeCloseTo(6, 6);
    expect(combineVideoPast([videoHistoryHours("youtube", yt), videoHistoryHours("netflix", nf)])).toEqual({ hours: 30, since: "2014-10" });
    expect(combineVideoPast([null])).toBeUndefined();
  });
  it("reads months", () => {
    expect(monthAsYear("2022-03")).toBeCloseTo(2022 + 2 / 12, 6);
    expect(monthName("2014-10")).toBe("October 2014");
  });
});

import { signInUsage, summaryFromSignIn } from "./ai/signin";
import { DEFAULT_CONTEXT as C, productById } from "./store";

describe("using whole history", () => {
  it("prices Gemini's past from every prompt in its history", () => {
    const u = signInUsage({ prompts: 30, history: { whole: true, monthly: [{ month: "2025-08", prompts: 1000 }, { month: "2026-09", prompts: 30 }] } })!;
    expect(u.promptsEver).toEqual({ total: 1030, since: "2025-08" });
    const s = summaryFromSignIn("gemini", u);
    expect(s.totalWh).toBeCloseTo((s.whPerDay * u.days * 1030) / 30, 6);
  });
  it("uses measured video hours for past use, estimating only the years before the history starts", () => {
    const video = productById("video")!;
    // A history reaching back before the person was online leaves nothing to estimate.
    const thisMonth = "1990-01";
    const estimated = video.cost(2, "past", C);
    const tiny = video.cost(2, "past", { ...C, videoPast: { hours: 10, since: thisMonth } });
    const huge = video.cost(2, "past", { ...C, videoPast: { hours: 100000, since: thisMonth } });
    expect(tiny).toBeLessThan(estimated);
    expect(huge).toBeGreaterThan(estimated);
    const recent = video.cost(2, "past", { ...C, videoPast: { hours: 10, since: "2026-01" } });
    expect(recent).toBeGreaterThan(tiny);
    expect(video.cost(2, "monthly", { ...C, videoPast: { hours: 100000, since: thisMonth } })).toBeCloseTo(video.cost(2, "monthly", C), 6);
  });
});
