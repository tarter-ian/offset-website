import { describe, expect, it } from "vitest";
import { GIFTABLE, giftPaid, giftRows, giftSpans, parseGift } from "./gifts";
import { productById } from "./store";

describe("gifts", () => {
  it("offers AI for a year or for life, and big items for a year only", () => {
    expect(giftSpans(productById("ai")!)).toEqual(["year", "life"]);
    expect(giftSpans(productById("desktop")!)).toEqual(["year"]);
    expect(GIFTABLE.length).toBeGreaterThan(5);
  });

  it("prices a gift as one-time gifts to the charities", () => {
    const rows = giftRows("car", "year");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.frequency === "ONCE")).toBe(true);
    expect(giftRows("desktop", "life")).toEqual([]);
  });

  it("checks what the giver sends", () => {
    const ok = parseGift({ id: "abcdef0123456789abcd", productId: "ai", span: "life", from: "  Ian ", to: "Sam", note: "x".repeat(300) });
    expect(ok.ok && ok.gift.from).toBe("Ian");
    expect(ok.ok && ok.gift.note.length).toBe(200);
    expect(parseGift({ id: "abcdef0123456789abcd", productId: "ai", span: "life", from: "", to: "Sam" }).ok).toBe(false);
    expect(parseGift({ id: "bad", productId: "ai", span: "life", from: "a", to: "b" }).ok).toBe(false);
    expect(parseGift({ id: "abcdef0123456789abcd", productId: "desktop", span: "life", from: "a", to: "b" }).ok).toBe(false);
  });

  it("counts a gift as paid only when every charity got at least what was asked", () => {
    const id = "abcdef0123456789abcd";
    const rows = giftRows("car", "year");
    const full = rows.map((r) => ({ partnerDonationId: `${id}.${r.key}`, amount: r.total }));
    expect(giftPaid(id, rows, full)).toBe(true);
    expect(giftPaid(id, rows, full.slice(1))).toBe(false);
    expect(giftPaid(id, rows, full.map((d) => ({ ...d, amount: 1 })).slice(0, rows.length))).toBe(rows.every((r) => r.donation <= 1));
    expect(giftPaid(id, [], full)).toBe(false);
  });
});
