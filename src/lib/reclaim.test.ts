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
});
