import { describe, expect, it } from "vitest";
import { GIFTABLE, giftPaid, giftPath, giftRows, giftSentence, giftUntil, parseGift, recipients } from "./gifts";
import { DEFAULT_CONTEXT as C, defaultAmount, productById } from "./store";

const ID = "abcdef0123456789abcd";

describe("gifts", () => {
  it("can gift every item with something to cover, for life too, with no price cap", () => {
    expect(GIFTABLE.length).toBeGreaterThan(20);
    const desk = giftRows([{ productId: "desktop", span: "life" }]);
    expect(desk.reduce((s, r) => s + r.donation, 0)).toBeGreaterThan(400);
  });

  it("prices years as the monthly amount times the months, in one-time gifts", () => {
    const car = productById("car")!;
    const rows = giftRows([{ productId: "car", span: "5years" }]);
    expect(rows.every((r) => r.frequency === "ONCE")).toBe(true);
    const raw = car.cost(defaultAmount(car, C), "monthly", C) * 60;
    const given = rows.reduce((s, r) => s + r.donation, 0);
    expect(given).toBeGreaterThanOrEqual(raw - 0.01);
    expect(given).toBeLessThan(raw + rows.length);
  });

  it("prices life by the recipient's age", () => {
    const young = giftRows([{ productId: "car", span: "life" }], new Date().getFullYear() - 22);
    const old = giftRows([{ productId: "car", span: "life" }], new Date().getFullYear() - 70);
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
    const rows = giftRows([{ productId: "car", span: "year" }, { productId: "tv", span: "life" }]);
    const full = rows.map((r) => ({ partnerDonationId: `${ID}.${r.key}`, amount: r.total }));
    expect(giftPaid(ID, rows, full)).toBe(true);
    expect(giftPaid(ID, rows, full.slice(1))).toBe(false);
    expect(giftPaid(ID, rows, full.map((d) => ({ ...d, amount: 0.5 })))).toBe(false);
    expect(giftPaid(ID, [], full)).toBe(false);
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
    expect(giftSentence(GIFTABLE.map((p, n) => ({ productId: p.id, span: n ? ("year" as const) : ("life" as const) })))).toMatch(/^your whole footprint for a year or longer:/);
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
    const sum = (rows: ReturnType<typeof giftRows>) => rows.reduce((s, r) => s + r.donation, 0);
    expect(sum(giftRows([{ productId: "car", span: "month" }]))).toBeLessThan(sum(giftRows([{ productId: "car", span: "year" }])));
  });

  it("covers several people in one payment, each with their own link", () => {
    // Three people pay the $1 minimum on a small share once, not three times.
    const one = giftRows([{ productId: "car", span: "year" }]);
    const three = giftRows([{ productId: "car", span: "year" }], undefined, 3);
    const total = (rows: typeof one) => rows.reduce((t, r) => t + r.donation, 0);
    expect(total(three)).toBeLessThanOrEqual(total(one) * 3);
    expect(total(three)).toBeGreaterThan(total(one) * 3 - 4);
    const r = parseGift({ id: ID, items: [{ productId: "ai", span: "life" }], from: "Ian", to: ["Sam", " ", "Alex"] });
    expect(r.ok && recipients(r.gift)).toEqual(["Sam", "Alex"]);
    expect(parseGift({ id: ID, items: [{ productId: "ai", span: "life" }], from: "Ian", to: Array(21).fill("A") }).ok).toBe(false);
    expect(giftPath(ID, 1, 2)).toBe(`/gift/${ID}?for=1`);
    expect(giftPath(ID, 0, 1)).toBe(`/gift/${ID}`);
  });
});
