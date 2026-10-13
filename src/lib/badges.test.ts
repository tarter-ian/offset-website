import { describe, expect, it } from "vitest";
import { badgesFor, filterCounts, fullBadge, matches, offsetItems, PAST, parseFilter, termLabel, toneOf, toOffset } from "./badges";
import { DEFAULT_CONTEXT, PRODUCTS } from "./store";

const AI = ["ai", "ai-media", "ai-video", "ai-coding"];
const life = (ids: string[]) => ids.map((productId) => ({ productId, until: null }));

describe("badges", () => {
  it("rolls a whole aisle into one badge and keeps loose items apart", () => {
    const b = badgesFor([...life(AI), { productId: "video", until: "2027-10-01T00:00:00.000Z" }]);
    expect(b).toEqual([
      { kind: "aisle", key: "ai", name: "AI", until: null },
      { kind: "item", key: "video", name: "Video streaming", until: "2027-10-01T00:00:00.000Z" },
    ]);
  });
  it("gives an aisle the shortest cover in it, and Fully Offset only for everything", () => {
    const b = badgesFor([...life(AI.slice(1)), { productId: "ai", until: "2027-01-01" }]);
    expect(b[0]).toMatchObject({ kind: "aisle", until: "2027-01-01" });
    expect(badgesFor(life(PRODUCTS.map((p) => p.id)))).toEqual([{ kind: "full", key: "full", name: "Fully Offset", until: null }]);
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
  it("colors by term, and an aisle with any past-use item is past use", () => {
    expect([null, "2027-10-01", PAST].map(toneOf)).toEqual(["life", "period", "past"]);
    const b = badgesFor([...life(AI.slice(1)), { productId: "ai", until: PAST }]);
    expect(b[0]).toMatchObject({ kind: "aisle", until: PAST });
    expect(badgesFor([...life(AI.slice(2)), { productId: "ai", until: PAST }, { productId: "ai-media", until: "2027-01-01" }])[0].until).toBe(PAST);
  });
  it("gives Fully Offset for everything there is to offset at the person's own amounts", () => {
    const needed = toOffset({}, DEFAULT_CONTEXT);
    // Nothing to offset at no use: typical use makes no AI video or coding.
    expect(needed).not.toContain("ai-video");
    expect(needed).toContain("ai");
    expect(toOffset({ "ai-coding": 5 }, DEFAULT_CONTEXT)).toContain("ai-coding");
    const NOW = Date.parse("2026-10-13T00:00:00Z");
    const all = Object.fromEntries(needed.map((id) => [id, { kind: "life" as const }]));
    expect(fullBadge(all, needed, NOW)).toEqual({ kind: "full", key: "full", name: "Fully Offset", until: null });
    // Not without one of them, and not on the whole store's terms.
    const most = Object.fromEntries(Object.entries(all).filter(([id]) => id !== "ai"));
    expect(fullBadge(most, needed, NOW)).toBeNull();
    expect(badgesFor(offsetItems(all, NOW)).some((b) => b.kind === "full")).toBe(false);
    // Autopay keeps a monthly item offset past its first month, through its next renewal.
    const auto = { ...all, car: { kind: "period" as const, until: "2026-09-20T00:00:00Z", autopay: "monthly" as const } };
    expect(fullBadge(auto, needed, NOW)?.until).toBe("2026-10-20T00:00:00.000Z");
    expect(fullBadge({ ...all, car: { kind: "period", until: "2026-09-20T00:00:00Z", past: true } }, needed, NOW)?.until).toBe(PAST);
    expect(fullBadge({ ...all, car: { kind: "period", until: "2026-09-20T00:00:00Z", past: false } }, needed, NOW)).toBeNull();
  });
  it("words the term", () => {
    expect(termLabel(PAST)).toBe("past use");
    expect(termLabel(null)).toBe("for life");
    expect(termLabel("monthly")).toBe("each month");
    expect(termLabel("2027-10-15T00:00:00.000Z")).toBe("through Oct 2027");
  });
});
