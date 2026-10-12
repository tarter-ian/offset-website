import { describe, expect, it } from "vitest";
import { GIFTABLE, giftPaid, giftRows, giftSentence, giftUntil, parseGift } from "./gifts";
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
    ).toBe("your AI chat and TV for life, and your driving for 5 years");
    expect(giftUntil({ productId: "car", span: "5years" }, "2026-10-12T00:00:00.000Z")).toBe("2031-10-12T00:00:00.000Z");
    expect(giftUntil({ productId: "ai", span: "life" }, "2026-10-12T00:00:00.000Z")).toBeNull();
  });
});
