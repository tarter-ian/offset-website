import { describe, expect, it } from "vitest";
import { badgesFor, filterCounts, matches, PAST, parseFilter, termLabel, toneOf } from "./badges";
import { PRODUCTS } from "./store";

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
  it("words the term", () => {
    expect(termLabel(PAST)).toBe("past use");
    expect(termLabel(null)).toBe("for life");
    expect(termLabel("monthly")).toBe("each month");
    expect(termLabel("2027-10-15T00:00:00.000Z")).toBe("through Oct 2027");
  });
});
