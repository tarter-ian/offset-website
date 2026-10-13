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

import { combinePast, deliveryPast, ridePast, usdSpend } from "./history";
import { WEEKS_PER_MONTH } from "./factors";

// Shaped like extension 0.20.0's answers, and 0.19.0's without the money fields.
const dd = {
  service: "doordash",
  orders: 4,
  deliveries: 3,
  pickups: 1,
  spend: 141.6,
  currency: "USD",
  daily: [{ date: "2026-10-01", orders: 4, deliveries: 3, spend: 141.6 }],
  history: { firstOrder: "2021-03-02", monthly: [{ month: "2021-03", orders: 8, spend: 200 }, { month: "2026-10", orders: 4, spend: 141.6 }] },
  truncated: false,
};
const ue = { service: "ubereats", orders: 0, deliveries: 0, spend: 0, currency: null, history: { monthly: [{ month: "2019-06", orders: 2, spend: 50 }] } };
const ddOld = { service: "doordash", orders: 2, deliveries: 2, pickups: 0, history: { monthly: [{ month: "2024-01", orders: 5 }] } };
const uber = {
  service: "uber",
  rides: 2,
  miles: 14,
  spend: 38.5,
  currency: "USD",
  history: { firstRide: "2018-05", monthly: [{ month: "2018-05", rides: 3, spend: 0 }, { month: "2026-10", rides: 2, spend: 38.5 }] },
};

describe("what orders and rides cost", () => {
  it("reads dollars only when the extension sent them in dollars", () => {
    expect(usdSpend(dd)).toBe(141.6);
    expect(usdSpend(ddOld)).toBeNull();
    expect(usdSpend({ ...dd, currency: "CAD" })).toBeNull();
    // Uber sends null for both when no ride was charged in dollars.
    expect(usdSpend({ ...uber, spend: null, currency: null })).toBeNull();
    expect(usdSpend(uber)).toBe(38.5);
  });
});

describe("delivery and ride past use", () => {
  it("counts deliveries by year at the last 30 days' share of deliveries", () => {
    expect(deliveryPast(dd)).toEqual({ byYear: { "2021": 6, "2026": 3 }, since: "2021-03", whole: true });
    // No orders lately: every order counts as a delivery.
    expect(deliveryPast(ue)).toEqual({ byYear: { "2019": 2 }, since: "2019-06", whole: true });
    expect(deliveryPast(ddOld)?.byYear).toEqual({ "2024": 5 });
    expect(deliveryPast({ ...dd, truncated: true })?.whole).toBe(false);
    expect(deliveryPast({ orders: 2, deliveries: 2 })).toBeNull();
  });
  it("adds DoorDash and Uber Eats together", () => {
    expect(combinePast([deliveryPast(dd), deliveryPast(ue), null])).toEqual({ byYear: { "2019": 2, "2021": 6, "2026": 3 }, since: "2019-06", whole: true });
    expect(combinePast([null, undefined])).toBeUndefined();
  });
  it("turns rides into miles at the last 30 days' miles per ride", () => {
    expect(ridePast(uber)).toEqual({ byYear: { "2018": 21, "2026": 14 }, since: "2018-05", whole: true });
    expect(ridePast({ ...uber, rides: 0, miles: 0 }, 5)?.byYear).toEqual({ "2018": 15, "2026": 10 });
  });
  it("prices past use from the history instead of today's habits", () => {
    const delivery = productById("delivery")!;
    const counted = (n: number) => delivery.cost(n / WEEKS_PER_MONTH, "monthly", C);
    const at = (p: ReturnType<typeof deliveryPast>) => ({ ...C, measuredPast: { delivery: p! } });
    // Only from the year past use counts from (2013 for the default birth year).
    const p = { byYear: { "2010": 100, "2021": 6, "2026": 3 }, since: "2010-01", whole: true };
    expect(delivery.cost(2, "past", at(p))).toBeCloseTo(counted(9), 6);
    expect(delivery.cost(2, "past", at(p))).toBeLessThan(delivery.cost(2, "past", C));
    expect(delivery.cost(2, "monthly", at(p))).toBeCloseTo(delivery.cost(2, "monthly", C), 6);
    expect(delivery.cost(2, "lifetime", at(p))).toBeCloseTo(delivery.cost(2, "past", at(p)) + delivery.cost(2, "future", C), 6);
    // A count that stopped early prices the years before it at today's habits.
    expect(delivery.cost(2, "past", at({ ...p, since: "2021-03", whole: false }))).toBeGreaterThan(delivery.cost(2, "past", at({ ...p, since: "2021-03" })));
    // Rides work the same way, in ride miles.
    const ride = productById("rideshare")!;
    expect(ride.cost(5, "past", { ...C, measuredPast: { rideshare: ridePast(uber)! } })).toBeCloseTo(ride.cost(35 / WEEKS_PER_MONTH, "monthly", C), 6);
  });
});
