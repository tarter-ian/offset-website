import { describe, expect, it } from "vitest";
import {
  defaultGiftSpan,
  GIFT_PRESETS,
  GIFTABLE,
  giftCharge,
  giftCharities,
  giftImpacts,
  type GiftItem,
  giftPath,
  giftSentence,
  giftSteps,
  giftUntil,
  parseGift,
  presetItems,
  recipients,
} from "./gifts";
import { owedPaid, sumTotal } from "./payments";
import { DEFAULT_CONTEXT as C, defaultAmount, productById } from "./store";

const ID = "abcdef0123456789abcd";
/** The Every.org gifts for a gift, as it is given in Every.org mode. */
const everyRows = (items: GiftItem[], birthYear?: number, people?: number) => giftCharge(items, birthYear, people, "every").rows;

describe("gifts", () => {
  it("can gift every item with something to cover, for life too, with no price cap", () => {
    expect(GIFTABLE.length).toBeGreaterThan(20);
    const desk = everyRows([{ productId: "desktop", span: "life" }]);
    expect(desk.reduce((s, r) => s + r.donation, 0)).toBeGreaterThan(400);
  });

  it("prices years as the monthly amount times the months, in one-time gifts", () => {
    const car = productById("car")!;
    const rows = everyRows([{ productId: "car", span: "5years" }]);
    expect(rows.every((r) => r.frequency === "ONCE")).toBe(true);
    const raw = car.cost(defaultAmount(car, C), "monthly", C) * 60;
    const given = rows.reduce((s, r) => s + r.donation, 0);
    expect(given).toBeGreaterThanOrEqual(raw - 0.01);
    expect(given).toBeLessThan(raw + rows.length);
  });

  it("prices life by the recipient's age", () => {
    const young = everyRows([{ productId: "car", span: "life" }], new Date().getFullYear() - 22);
    const old = everyRows([{ productId: "car", span: "life" }], new Date().getFullYear() - 70);
    const sum = (r: typeof young) => r.reduce((s, x) => s + x.donation, 0);
    expect(sum(young)).toBeGreaterThan(sum(old) * 3);
  });

  it("checks what the giver sends", () => {
    const ok = parseGift({ id: ID, items: [{ productId: "ai", span: "life" }], from: "  Ian ", to: "Sam", note: "x".repeat(300) });
    expect(ok.ok && ok.gift.from).toBe("Ian");
    expect(ok.ok && ok.gift.note.length).toBe(200);
    expect(ok.ok && ok.gift.birthYear).toBe(C.birthYear);
    expect(parseGift({ id: ID, items: [{ productId: "ai", span: "life" }], from: "", to: "Sam" }).ok).toBe(false);
    expect(parseGift({ id: "bad", items: [{ productId: "ai", span: "life" }], from: "a", to: "b" }).ok).toBe(false);
    expect(parseGift({ id: ID, items: [], from: "a", to: "b" }).ok).toBe(false);
    expect(parseGift({ id: ID, items: [{ productId: "ai", span: "forever" }], from: "a", to: "b" }).ok).toBe(false);
    expect(parseGift({ id: ID, items: [{ productId: "ai", span: "life" }, { productId: "ai", span: "year" }], from: "a", to: "b" }).ok).toBe(false);
  });

  it("counts a gift as paid only when every charity got at least what was asked", () => {
    const rows = everyRows([{ productId: "car", span: "year" }, { productId: "tv", span: "life" }]);
    const full = rows.map((r) => ({ partnerDonationId: `${ID}.${r.key}`, amount: r.total }));
    expect(owedPaid(ID, rows, full)).toBe(true);
    expect(owedPaid(ID, rows, full.slice(1))).toBe(false);
    expect(owedPaid(ID, rows, full.map((d) => ({ ...d, amount: 0.5 })))).toBe(false);
    expect(owedPaid(ID, [], full)).toBe(false);
  });

  it("reads as a sentence on the card", () => {
    expect(
      giftSentence([
        { productId: "ai", span: "life" },
        { productId: "tv", span: "life" },
        { productId: "car", span: "5years" },
      ]),
    ).toBe("your TV and AI chat for life, and your driving for 5 years");
    expect(giftSentence(GIFTABLE.map((p) => ({ productId: p.id, span: "life" as const })))).toMatch(/^your whole footprint for life/);
    expect(giftSentence(GIFTABLE.map((p) => ({ productId: p.id, span: "month" as const })))).toMatch(/^your whole footprint for a month:/);
    expect(giftSentence(GIFTABLE.map((p) => ({ productId: p.id, span: defaultGiftSpan(p) })))).toBe(
      "all your AI use, everything you do online and all your devices for life, and everything else for a year",
    );
    const travel = GIFTABLE.filter((p) => p.section === "travel");
    const food = GIFTABLE.filter((p) => p.section === "food");
    const year = (ps: typeof GIFTABLE) => ps.map((p) => ({ productId: p.id, span: "year" as const }));
    expect(giftSentence(year([...travel, ...food]))).toBe("all your travel and all your food for a year");
    expect(giftSentence([...year(travel), { productId: "tv", span: "year" }])).toBe("all your travel and your TV for a year");
    const online = GIFTABLE.filter((p) => p.section === "online");
    const s = giftSentence(year(online.slice(0, -1)));
    expect(s).toMatch(/more things? for a year$/);
    expect(giftUntil({ productId: "car", span: "5years" }, "2026-10-12T00:00:00.000Z")).toBe("2031-10-12T00:00:00.000Z");
    expect(giftUntil({ productId: "ai", span: "life" }, "2026-10-12T00:00:00.000Z")).toBeNull();
    expect(giftUntil({ productId: "car", span: "month" }, "2026-10-12T00:00:00.000Z")).toBe("2026-11-12T00:00:00.000Z");
    const sum = (rows: ReturnType<typeof everyRows>) => rows.reduce((s, r) => s + r.donation, 0);
    expect(sum(everyRows([{ productId: "car", span: "month" }]))).toBeLessThan(sum(everyRows([{ productId: "car", span: "year" }])));
  });

  it("covers several people in one payment, each with their own link", () => {
    // Three people pay the $1 minimum on a small share once, not three times.
    const one = everyRows([{ productId: "car", span: "year" }]);
    const three = everyRows([{ productId: "car", span: "year" }], undefined, 3);
    const total = (rows: typeof one) => rows.reduce((t, r) => t + r.donation, 0);
    expect(total(three)).toBeLessThanOrEqual(total(one) * 3);
    expect(total(three)).toBeGreaterThan(total(one) * 3 - 4);
    const r = parseGift({ id: ID, items: [{ productId: "ai", span: "life" }], from: "Ian", to: ["Sam", " ", "Alex"] });
    expect(r.ok && recipients(r.gift)).toEqual(["Sam", "Alex"]);
    expect(parseGift({ id: ID, items: [{ productId: "ai", span: "life" }], from: "Ian", to: Array(21).fill("A") }).ok).toBe(false);
    expect(giftPath(ID, 1, 2)).toBe(`/gift/${ID}?for=1`);
    expect(giftPath(ID, 0, 1)).toBe(`/gift/${ID}`);
  });

  it("lists the quick picks with the year first and the dearest not first", () => {
    const totals = GIFT_PRESETS.map((p) => sumTotal(everyRows(presetItems(p))));
    expect(GIFT_PRESETS[0].label).toBe("Everything for a year");
    expect(totals[0]).toBeLessThan(Math.max(...totals));
    expect(totals[0]).toBeGreaterThan(0);
  });

  it("says how many gifts the giver makes, and where, in either payment mode", () => {
    expect(giftSteps(4, 1, "every")).toBe("You'll make 4 gifts on Every.org, one per charity. Your link works once all 4 are confirmed.");
    expect(giftSteps(1, 2, "every")).toBe("You'll make 1 gift on Every.org. Your links work once it's confirmed.");
    // Through Endaoment a gift is one payment to the fund, like the store's, and never mentions Every.org.
    expect(giftSteps(4, 1, "endaoment")).toBe("You'll make 1 gift to My Offset's fund at Endaoment, which grants each charity its part. Your link works once it's confirmed.");
  });

  it("names what a gift offsets and where the money goes", () => {
    const car = productById("car")!;
    const year = giftImpacts([{ productId: "car", span: "year" }]);
    expect(year.carbon).toBeCloseTo(car.impacts(defaultAmount(car, C), "monthly", C).carbon * 12);
    expect(giftImpacts([{ productId: "car", span: "life" }]).carbon).toBeGreaterThan(year.carbon * 10);
    const everything = GIFTABLE.map((p) => ({ productId: p.id, span: "year" as const }));
    const all = giftCharities(everything, undefined, "every");
    expect(all).toEqual(["Clean Air Task Force", "Colorado Water Trust", "Rainforest Trust", "PCs for People"]);
    expect(giftCharities(everything, undefined, "endaoment")).toEqual(all);
  });
});
