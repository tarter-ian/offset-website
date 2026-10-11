import { describe, expect, it } from "vitest";
import { activityAmounts, parseActivityJson, parseNetflix, YOUTUBE_MIN_PER_SHORT, YOUTUBE_MIN_PER_VIDEO, youtubeDays } from "./activity";

const DAY = 86_400_000;
const END = Date.UTC(2026, 9, 1);
const daysAgo = (n: number) => new Date(END - n * DAY).toISOString();

describe("activity exports", () => {
  it("reads Spotify's extended and account streaming history", () => {
    const extended = Array.from({ length: 60 }, (_, i) => ({ ts: daysAgo(i), ms_played: 3_600_000, master_metadata_track_name: "x" }));
    const f = parseActivityJson(extended)!;
    expect(f.source).toBe("spotify");
    expect(activityAmounts(f.events, END)!.amounts.music).toBeCloseTo(1, 1);
    const account = [{ endTime: "2026-09-30 18:20", artistName: "a", trackName: "b", msPlayed: 180_000 }];
    expect(parseActivityJson(account)!.events[0].amount).toBeCloseTo(0.05, 6);
  });

  it("reads YouTube watch history, skipping ads and counting YouTube Music as music", () => {
    const rows = [
      ...Array.from({ length: 30 }, (_, i) => ({ header: "YouTube", title: "Watched a video", time: daysAgo(i) })),
      { header: "YouTube", title: "Watched an ad", time: daysAgo(1), details: [{ name: "From Google Ads" }] },
      { header: "YouTube Music", title: "Watched a song", time: daysAgo(2) },
    ];
    const f = parseActivityJson(rows)!;
    expect(f.source).toBe("youtube");
    expect(f.events.filter((e) => e.target === "video")).toHaveLength(30);
    expect(f.events.filter((e) => e.target === "music")).toHaveLength(1);
    expect(activityAmounts(f.events, END)!.amounts.video).toBeCloseTo(YOUTUBE_MIN_PER_VIDEO / 60, 1);
  });

  it("reads Netflix's full viewing activity and its simple history, skipping trailers", () => {
    const full = [
      "Profile Name,Start Time,Duration,Attributes,Title,Supplemental Video Type,Device Type,Bookmark,Latest Bookmark,Country",
      'Ian,2026-09-30 20:00:00,01:30:00,,"Movie, The",,TV,01:30:00,01:30:00,US (United States)',
      "Ian,2026-09-29 20:00:00,00:02:00,,Trailer,TRAILER,TV,00:02:00,00:02:00,US (United States)",
    ].join("\n");
    expect(parseNetflix(full)).toEqual([{ target: "video", time: Date.UTC(2026, 8, 30, 20), amount: 1.5 }]);
    const simple = 'Title,Date\n"Show: Season 1: Pilot",9/30/26\n';
    expect(parseNetflix(simple)).toHaveLength(1);
  });

  it("reads Google Maps Timeline in its phone and Takeout formats", () => {
    const phone = {
      semanticSegments: [
        { startTime: daysAgo(0), activity: { distanceMeters: 16093.44, topCandidate: { type: "IN_PASSENGER_VEHICLE" } } },
        { startTime: daysAgo(1), activity: { distanceMeters: 1609.344, topCandidate: { type: "IN_SUBWAY" } } },
        { startTime: daysAgo(2), activity: { distanceMeters: 1609.344, topCandidate: { type: "WALKING" } } },
        { startTime: daysAgo(10), activity: { distanceMeters: 1_000_000, topCandidate: { type: "FLYING" } } },
        { startTime: daysAgo(14), activity: { distanceMeters: 1_000_000, topCandidate: { type: "FLYING" } } },
        { startTime: daysAgo(29), visit: {} },
      ],
    };
    const f = parseActivityJson(phone)!;
    expect(f.source).toBe("timeline");
    expect(f.events.map((e) => e.target)).toEqual(["car", "transit", "flights", "flights"]);
    expect(f.events[0].amount).toBeCloseTo(10, 6);

    const takeout = {
      timelineObjects: [{ activitySegment: { distance: 8046.72, activityType: "IN_PASSENGER_VEHICLE", duration: { startTimestamp: daysAgo(3) } } }],
    };
    expect(parseActivityJson(takeout)!.events[0]).toMatchObject({ target: "car", amount: 5 });
    const ios = [{ startTime: daysAgo(3), activity: { topCandidate: { type: "in passenger vehicle" }, distanceMeters: "1609.344" } }];
    expect(parseActivityJson(ios)!.events[0]).toMatchObject({ target: "car", amount: 1 });
  });

  it("averages each kind of use over its own last year", () => {
    const events = [
      ...Array.from({ length: 400 }, (_, i) => ({ target: "car" as const, time: END - i * DAY, amount: 10 })),
      { target: "flights" as const, time: END - 100 * DAY, amount: 1 },
      { target: "flights" as const, time: END - 96 * DAY, amount: 1 },
      { target: "flights" as const, time: END - 500 * DAY, amount: 1 },
    ];
    const a = activityAmounts(events, END)!;
    expect(a.amounts.car).toBe(70);
    expect(a.amounts.flights).toBe(1);
  });

  it("averages a short recent sample over its own span", () => {
    const sample = Array.from({ length: 50 }, (_, i) => ({ target: "music" as const, time: END - i * 3_600_000, amount: 0.05, sample: true }));
    // 2.5 hours across about two days, not spread over a month.
    expect(activityAmounts(sample, END)!.amounts.music).toBeCloseTo(1.2, 1);
  });

  it("ignores files it doesn't recognize", () => {
    expect(parseActivityJson({ hello: 1 })).toBeNull();
    expect(parseActivityJson([{ a: 1 }])).toBeNull();
    expect(parseNetflix("a,b\n1,2")).toBeNull();
  });

  it("uses the extension's YouTube watch hours, except from versions that overcounted", () => {
    // Before 0.5 the hours ran high (cappedDays marks that format), so a typical time per video is used instead.
    const old = youtubeDays({ cappedDays: 1, daily: [{ date: "2026-10-01", videos: 10, shorts: 120, hours: 24 }] });
    expect(old).toEqual([{ target: "video", time: Date.parse("2026-10-01"), amount: (10 * YOUTUBE_MIN_PER_VIDEO + 120 * YOUTUBE_MIN_PER_SHORT) / 60 }]);
    const now = youtubeDays({ watchedHours: 2.5, daily: [{ date: "2026-10-01", videos: 10, shorts: 120, hours: 2.5 }] });
    expect(now).toEqual([{ target: "video", time: Date.parse("2026-10-01"), amount: 2.5 }]);
  });
});
