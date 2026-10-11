import { describe, expect, it } from "vitest";
import { checkSessionToken, enabledReclaimServices, reclaimEvents, sessionToken } from "./reclaim";

describe("reclaim sign-in", () => {
  it("is off until its keys are set", () => {
    expect(enabledReclaimServices()).toEqual([]);
  });

  it("only accepts proofs from sessions this server started", () => {
    const t = sessionToken("abc", "netflix", "v1", "secret");
    expect(checkSessionToken(t, "abc", "netflix", "v1", "secret")).toBe(true);
    expect(checkSessionToken(t, "other", "netflix", "v1", "secret")).toBe(false);
    expect(checkSessionToken(t, "abc", "uber", "v1", "secret")).toBe(false);
    expect(checkSessionToken("00", "abc", "netflix", "v1", "secret")).toBe(false);
  });

  it("reads rides, listening and viewing from extracted data", () => {
    const rides = reclaimEvents("uber", { trips: JSON.stringify([{ requestTime: "2026-09-01T10:00:00Z", distance: "4.2" }]) });
    expect(rides).toEqual([{ target: "car", time: Date.parse("2026-09-01T10:00:00Z"), amount: 4.2 }]);
    const songs = reclaimEvents("spotify", { items: JSON.stringify({ items: [{ played_at: "2026-09-01T10:00:00Z", duration_ms: 180000 }] }) });
    expect(songs[0]).toMatchObject({ target: "music", amount: 0.05 });
    const shows = reclaimEvents("netflix", { history: "Title,Date\nShow,9/30/26" });
    expect(shows).toHaveLength(1);
    expect(reclaimEvents("youtube", { name: "Ian" })).toEqual([]);
  });

  it("reads the history the chosen providers return as public data", () => {
    const netflix = reclaimEvents("netflix", { displayName: "Ian" }, { watchHistory: [{ title: "Show", titleId: "1", date: "9/30/26" }], totalTitlesWatched: 1 });
    expect(netflix).toEqual([{ target: "video", time: Date.UTC(2026, 8, 30), amount: 40 / 60 }]);
    const spotify = reclaimEvents("spotify", { currentPlan: "premium" }, JSON.stringify({ tracks: [{ played_at: "2026-09-30T20:00:00Z", track: { duration_ms: 240000 } }] }));
    expect(spotify).toEqual([{ target: "music", time: Date.parse("2026-09-30T20:00:00Z"), amount: 240000 / 3_600_000, sample: true }]);
    const uber = reclaimEvents("uber", { userId: "u" }, {
      rides: [
        { requestTime: "2026-09-29T08:00:00Z", distance: "8.05 km", status: "COMPLETED" },
        { requestTime: "2026-09-30T08:00:00Z", distance: "3 mi", status: "RIDER_CANCELED" },
      ],
    });
    expect(uber).toHaveLength(1);
    expect(uber[0].amount).toBeCloseTo(5, 1);
  });
});

describe("our own sign-ins", () => {
  it("turns YouTube's daily counts into viewing time at a typical length", () => {
    const yt = reclaimEvents("youtube", { loggedIn: "true" }, { videos: 10, shorts: 120, watchedHours: 900, daily: [{ date: "2026-10-01", videos: 10, shorts: 120, hours: 30 }] });
    expect(yt).toEqual([{ target: "video", time: Date.parse("2026-10-01"), amount: (10 * 12 + 120 * 0.5) / 60 }]);
  });
});
