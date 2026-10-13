import { describe, expect, it } from "vitest";
import { badgeKey, badgesFor, filterCounts, fullBadges, topBadges, matches, offsetItems, PAST, parseFilter, REST, termLabel, termPhrase, toneOf, toOffset, zeroUse } from "./badges";
import { DEFAULT_CONTEXT, PRODUCTS } from "./store";

const AI = ["ai", "ai-media", "ai-video", "ai-coding"];
const life = (ids: string[]) => ids.map((productId) => ({ productId, until: null, past: true }));
const top = (items: Parameters<typeof badgesFor>[0]) => topBadges(badgesFor(items));

describe("badges", () => {
  it("rolls a whole aisle into one badge and keeps loose items apart", () => {
    const b = top([...life(AI), { productId: "video", until: "2027-10-01T00:00:00.000Z" }]);
    expect(b).toEqual([
      { kind: "aisle", key: "ai", name: "AI", until: null },
      { kind: "item", key: "video", name: "Video streaming", until: "2027-10-01T00:00:00.000Z" },
    ]);
  });
  it("gives an aisle the shortest cover in it, and Fully Offset only for everything", () => {
    const b = badgesFor([...life(AI.slice(1)), { productId: "ai", until: "2027-01-01" }]);
    expect(b[0]).toMatchObject({ kind: "aisle", until: "2027-01-01" });
    expect(top(life(PRODUCTS.map((p) => p.id)))).toEqual([{ kind: "full", key: "full", name: "Fully Offset", until: null }]);
    expect(badgesFor([])).toEqual([]);
  });
  it("filters by Fully Offset, aisle or item, and counts each", () => {
    const people = [life(PRODUCTS.map((p) => p.id)), life(["ai"]), life(["car"])];
    expect(parseFilter({ aisle: "everything" })).toEqual({ kind: "full" });
    expect(parseFilter({ aisle: "nope" })).toEqual({ kind: "everyone" });
    expect(parseFilter({ aisle: "ai", item: "ai-video" })).toEqual({ kind: "item", key: "ai-video" });
    expect(people.filter((p) => matches(p, { kind: "aisle", key: "ai" }))).toHaveLength(2);
    expect(people.filter((p) => matches(p, { kind: "full" }))).toHaveLength(1);
    const c = filterCounts(people);
    expect(c.everything).toBe(1);
    expect(c.ai).toBe(2);
    expect(c["item:ai"]).toBe(2);
    expect(c.food).toBe(1);
  });
  it("colors by term, and an aisle with a past-use item shows past use", () => {
    expect([null, "2027-10-01", PAST].map(toneOf)).toEqual(["life", "period", "past"]);
    const b = badgesFor([...life(AI.slice(1)), { productId: "ai", until: PAST }]);
    expect(b[0]).toMatchObject({ kind: "aisle", until: PAST });
  });
  it("gives Fully Offset for everything there is to offset at the person's own amounts", () => {
    const needed = toOffset({}, DEFAULT_CONTEXT);
    // Nothing to offset at no use: typical use makes no AI video or coding.
    expect(needed).not.toContain("ai-video");
    expect(needed).toContain("ai");
    expect(toOffset({ "ai-coding": 5 }, DEFAULT_CONTEXT)).toContain("ai-coding");
    const NOW = Date.parse("2026-10-13T00:00:00Z");
    const all = Object.fromEntries(needed.map((id) => [id, { kind: "life" as const, past: true }]));
    const zero = zeroUse({}, DEFAULT_CONTEXT);
    expect(fullBadges(all, zero, NOW)).toEqual([{ kind: "full", key: "full", name: "Fully Offset", until: null }]);
    // Not without one of them, and not on the whole store's terms.
    const most = Object.fromEntries(Object.entries(all).filter(([id]) => id !== "ai"));
    expect(fullBadges(most, zero, NOW)).toEqual([]);
    expect(badgesFor(offsetItems(all, NOW)).some((b) => b.kind === "full")).toBe(false);
    // Autopay keeps a monthly item offset past its first month, through its next renewal: blue, since its past isn't paid.
    const auto = { ...all, car: { kind: "period" as const, until: "2026-09-20T00:00:00Z", autopay: "monthly" as const } };
    expect(fullBadges(auto, zero, NOW).map((b) => b.until)).toEqual(["2026-10-20T00:00:00.000Z"]);
    // Every past paid, one future ended: yellow alone. Past unpaid on the ended one: no Fully Offset.
    expect(fullBadges({ ...all, car: { kind: "period", until: "2026-09-20T00:00:00Z", past: true } }, zero, NOW).map((b) => b.until)).toEqual([PAST]);
    expect(fullBadges({ ...all, car: { kind: "period", until: "2026-09-20T00:00:00Z", past: false } }, zero, NOW)).toEqual([]);
    // Every past paid and every future running: yellow and blue.
    expect(fullBadges({ ...all, car: { kind: "period", until: "2026-11-01T00:00:00Z", past: true } }, zero, NOW).map((b) => b.until)).toEqual([PAST, "2026-11-01T00:00:00Z"]);
  });
  it("colors each item by what's paid: green, blue, yellow, or yellow and blue", () => {
    const one = (i: { until: string | null; past?: boolean }) => badgesFor([{ productId: "video", ...i }]).map((b) => b.until);
    expect(one({ until: null, past: true })).toEqual([null]);
    expect(one({ until: null })).toEqual([REST]);
    expect(one({ until: "2027-01-01" })).toEqual(["2027-01-01"]);
    expect(one({ until: PAST, past: true })).toEqual([PAST]);
    expect(one({ until: "2027-01-01", past: true })).toEqual([PAST, "2027-01-01"]);
    expect(toneOf(REST)).toBe("period");
    expect(termLabel(REST)).toBe("rest of life");
    expect(termPhrase([PAST, REST])).toBe("for past use, and for the rest of life");
  });
  it("gives an aisle green only when every item is, and otherwise what every item shares", () => {
    const green = AI.slice(1).map((productId) => ({ productId, until: null, past: true }));
    expect(top([...green, { productId: "ai", until: null, past: true }])).toEqual([{ kind: "aisle", key: "ai", name: "AI", until: null }]);
    // One item's future for life without its past: the aisle's future is for life, its past isn't all paid.
    expect(top([...green, { productId: "ai", until: null }]).map((b) => b.until)).toEqual([REST]);
    // One item past only: every past is paid, not every future.
    expect(top([...green, { productId: "ai", until: PAST, past: true }]).map((b) => b.until)).toEqual([PAST]);
    // One past only, one future only: nothing shared, so the items show one by one.
    const split = badgesFor([...life(AI.slice(2)), { productId: "ai", until: PAST, past: true }, { productId: "ai-media", until: "2027-01-01" }]);
    expect(split.every((b) => b.kind === "item")).toBe(true);
    expect(new Set(split.map(badgeKey)).size).toBe(split.length);
  });
  it("gives items at zero use their own green badge, beside something paid", () => {
    const NOW = Date.parse("2026-10-13T00:00:00Z");
    const zero = zeroUse({}, DEFAULT_CONTEXT);
    expect(zero).toEqual(expect.arrayContaining(["ai-video", "ai-coding"]));
    expect(zero).not.toContain("ai");
    // Chat paid for life: video and coding at zero show as their own items, for life.
    const chat = { ai: { kind: "life" as const, past: true } };
    expect(badgesFor(offsetItems(chat, NOW, zero))).toEqual([
      { kind: "item", key: "ai", name: "AI chat", until: null },
      { kind: "item", key: "ai-video", name: "AI video", until: null },
      { kind: "item", key: "ai-coding", name: "Coding with AI", until: null },
    ]);
    expect(offsetItems(chat, NOW, zero).filter((i) => i.zero).map((i) => i.productId)).toEqual(["ai-video", "ai-coding"]);
    // With images paid too, the AI aisle completes, on the paid items' shortest term.
    const aisle = badgesFor(offsetItems({ ...chat, "ai-media": { kind: "period", until: "2027-01-01T00:00:00Z" } }, NOW, zero));
    expect(aisle[0]).toEqual({ kind: "aisle", key: "ai", name: "AI", until: "2027-01-01T00:00:00Z" });
    // Nothing paid, no badges: zero use alone earns none.
    expect(offsetItems({}, NOW, zero)).toEqual([]);
    // A paid item keeps its own date even at zero use.
    const video = offsetItems({ ...chat, "ai-video": { kind: "period", until: "2026-11-01T00:00:00Z" } }, NOW, zero);
    expect(video.find((i) => i.productId === "ai-video")).toEqual({ productId: "ai-video", until: "2026-11-01T00:00:00Z" });
  });
  it("drops the zero-use badge once use goes above zero", () => {
    const NOW = Date.parse("2026-10-13T00:00:00Z");
    const zero = zeroUse({ "ai-video": 3 }, DEFAULT_CONTEXT);
    expect(zero).not.toContain("ai-video");
    expect(zero).toContain("ai-coding");
    const items = offsetItems({ ai: { kind: "life", past: true } }, NOW, zero);
    expect(items.some((i) => i.productId === "ai-video")).toBe(false);
    // And Fully Offset waits for it to be offset.
    const rest = Object.fromEntries(toOffset({ "ai-video": 3 }, DEFAULT_CONTEXT).filter((id) => id !== "ai-video").map((id) => [id, { kind: "life" as const, past: true }]));
    expect(fullBadges(rest, zero, NOW)).toEqual([]);
    expect(fullBadges({ ...rest, "ai-video": { kind: "life", past: true } }, zero, NOW)[0]?.until).toBeNull();
  });
  it("counts a vegan's meat or a non-driver's car as zero use", () => {
    expect(zeroUse({ meat: "vegan", car: 0 }, DEFAULT_CONTEXT)).toEqual(expect.arrayContaining(["meat", "car"]));
    expect(zeroUse({ car: 50 }, DEFAULT_CONTEXT)).not.toContain("car");
  });
  it("filters by color, with green under past paid and future paid too", () => {
    const green = [{ productId: "ai", until: null, past: true }];
    const blue = [{ productId: "video", until: "2027-01-01" }];
    const rest = [{ productId: "video", until: null }];
    const yellow = [{ productId: "car", until: PAST, past: true }];
    const pair = [{ productId: "car", until: "2027-01-01", past: true }];
    const people = { green, blue, rest, yellow, pair };
    const who = (status: "life" | "past" | "future") =>
      Object.entries(people)
        .filter(([, items]) => matches(items, { kind: "status", status }))
        .map(([k]) => k);
    expect(who("life")).toEqual(["green"]);
    expect(who("past")).toEqual(["green", "yellow", "pair"]);
    expect(who("future")).toEqual(["green", "blue", "rest", "pair"]);
    // Zero use is green.
    expect(matches([...blue, { productId: "ai-video", until: null, zero: true }], { kind: "status", status: "past" })).toBe(true);
    expect(parseFilter({ status: "future" })).toEqual({ kind: "status", status: "future" });
    expect(parseFilter({ status: "nope" })).toEqual({ kind: "everyone" });
    const c = filterCounts(Object.values(people));
    expect([c["status:life"], c["status:past"], c["status:future"]]).toEqual([1, 3, 4]);
  });
  it("earns every lower badge inside a higher one, in the higher one's color", () => {
    const all = badgesFor(life(PRODUCTS.map((p) => p.id)));
    expect(topBadges(all)).toHaveLength(1);
    expect(all.filter((b) => b.kind === "aisle")).toHaveLength(7);
    expect(all.filter((b) => b.kind === "item")).toHaveLength(PRODUCTS.length);
    expect(all.every((b) => b.until === null)).toBe(true);
    expect(all.find((b) => b.key === "video")?.within).toBe("online");
    expect(all.find((b) => b.key === "online")?.within).toBe("full");
    // One color: under a blue Fully Offset, a green item shows blue, never green beside it.
    const mixed = badgesFor([...life(PRODUCTS.map((p) => p.id).filter((id) => id !== "car")), { productId: "car", until: null }]);
    expect(new Set(mixed.map((b) => b.until))).toEqual(new Set([REST]));
    expect(mixed.filter((b) => b.key === "ai" && b.kind === "item")).toEqual([{ kind: "item", key: "ai", name: "AI chat", until: REST, within: "ai" }]);
    // A green badge never also shows yellow or blue.
    expect(badgesFor(life(["video"]))).toEqual([{ kind: "item", key: "video", name: "Video streaming", until: null }]);
  });
  it("rolls filters up the tiers: Fully Offset or an aisle shows under each item inside", () => {
    const full = life(PRODUCTS.map((p) => p.id));
    const online = life(PRODUCTS.filter((p) => p.section === "online").map((p) => p.id));
    expect(matches(full, { kind: "item", key: "video" })).toBe(true);
    expect(matches(full, { kind: "aisle", key: "travel" })).toBe(true);
    expect(matches(online, { kind: "item", key: "video" })).toBe(true);
    expect(matches(online, { kind: "item", key: "car" })).toBe(false);
    // And with the colors: green Fully Offset shows under past paid and future paid.
    expect(matches(full, { kind: "status", status: "past" })).toBe(true);
    expect(matches(full, { kind: "status", status: "future" })).toBe(true);
    expect(filterCounts([full, online])["item:video"]).toBe(2);
  });
  it("words the term", () => {
    expect(termLabel(PAST)).toBe("past use");
    expect(termLabel(null)).toBe("for life");
    expect(termLabel("monthly")).toBe("each month");
    expect(termLabel("2027-10-15T00:00:00.000Z")).toBe("through Oct 2027");
  });
});
