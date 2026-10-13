import { afterEach, describe, expect, it, vi } from "vitest";
import { chargeTotal, giftCharge, type GiftItem, giftOwed, giftPaidMode } from "./gifts";
import { chargeSummary, FUND_KEY, fundGifts, owedPaid, payRows } from "./payments";
import { parsePlanClaim, planRows } from "./publicList";
import { DEFAULT_CONTEXT as C, harmSplit, planTotals } from "./store";

// Gifts and the public list follow the same payment switch as the plan's checkout
// (Ian, 2026-10-13: "the end goal is using endaoment ... is there a way to code that
// in so we don't forget"). These fail loudly if either goes back to Every.org rows
// while the site gives through the Endaoment fund.

const ID = "abcdef0123456789abcd";
const items: GiftItem[] = [
  { productId: "ai", span: "life" },
  { productId: "car", span: "year" },
];
const gift = { id: ID, items, birthYear: C.birthYear, to: "Sam\nAlex" };
const lines = [
  { productId: "ai", amount: 10, cover: { past: true, ahead: "lifetime" as const } },
  { productId: "car", amount: 200, cover: { past: false, ahead: "monthly" as const } },
];
const claim = parsePlanClaim({ planId: ID, billing: "monthly", lines, ctx: C, pastYears: 0, autopay: false })!;

describe("in Endaoment mode", () => {
  it("a gift is one payment to the fund, with no Every.org rows and no $1 minimums", () => {
    const c = giftCharge(items, C.birthYear, 2, "endaoment");
    expect(c.rows).toEqual([]);
    expect(c.fund).toBeDefined();
    expect(c.fund!.parts.map((p) => p.charity).sort()).toEqual([...new Set(giftCharge(items, C.birthYear, 2, "every").rows.map((r) => r.charity))].sort());
    // A share under a dollar stays under a dollar: nothing is rounded up to a minimum.
    const small = giftCharge([{ productId: "ai", span: "month" }], C.birthYear, 1, "endaoment").fund!;
    expect(small.parts.some((p) => p.amount < 1)).toBe(true);
    expect(chargeTotal(c)).toBe(c.fund!.total);
  });

  it("a gift counts as paid only from the fund's record, the same key the checkout uses", () => {
    const owed = giftOwed(gift, "endaoment");
    expect(owed.map((o) => o.key)).toEqual([FUND_KEY]);
    const donation = owed[0].donation;
    expect(owedPaid(ID, owed, [{ partnerDonationId: `${ID}.fund`, amount: donation }])).toBe(true);
    expect(owedPaid(ID, owed, [{ partnerDonationId: `${ID}.fund`, amount: donation - 1 }])).toBe(false);
    expect(giftPaidMode(gift, [{ partnerDonationId: `${ID}.fund`, amount: donation }])).toBe("endaoment");
  });

  it("a list claim checks the same one gift to the fund that checkout charges", () => {
    const owed = planRows(claim, "endaoment");
    expect(owed.map((o) => o.key)).toEqual([FUND_KEY]);
    const split = harmSplit(planTotals(claim.lines, claim.ctx, claim.billing, claim.pastYears), claim.ctx, claim.billing);
    expect(owed[0].donation).toBe(fundGifts(split).today.donation);
    expect(chargeSummary(split, claim.billing, false, "endaoment").today).toBe(fundGifts(split).today.total);
  });

  it("is the default once the site is switched, for gifts and the list alike", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_MODE", "endaoment");
    vi.stubEnv("NEXT_PUBLIC_ENDAOMENT_FUND_URL", "https://app.endaoment.org/funds/example");
    vi.resetModules();
    const g = await import("./gifts");
    const l = await import("./publicList");
    const p = await import("./payments");
    expect(p.PAYMENT_MODE).toBe("endaoment");
    const everyRow = (o: { key: string }) => o.key !== FUND_KEY;
    expect(g.giftCharge(items, C.birthYear, 2).rows, "a gift still builds Every.org rows in Endaoment mode").toEqual([]);
    expect(g.giftOwed(gift).filter(everyRow), "a gift is still checked against Every.org rows in Endaoment mode").toEqual([]);
    expect(l.planRows(claim).filter(everyRow), "the list still checks Every.org rows in Endaoment mode").toEqual([]);
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("in Every.org mode", () => {
  it("a gift and a list claim are one gift per charity, as before", () => {
    const c = giftCharge(items, C.birthYear, 1, "every");
    expect(c.fund).toBeUndefined();
    expect(c.rows.length).toBeGreaterThan(1);
    expect(c.rows.every((r) => r.frequency === "ONCE" && r.donation >= 1)).toBe(true);
    expect(giftOwed({ ...gift, to: "Sam" }, "every")).toEqual(c.rows);
    const split = harmSplit(planTotals(claim.lines, claim.ctx, claim.billing, claim.pastYears), claim.ctx, claim.billing);
    expect(planRows(claim, "every")).toEqual(payRows(split, "monthly", false, "every"));
  });

  it("is the default when nothing is switched", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_MODE", "");
    vi.resetModules();
    const g = await import("./gifts");
    expect(g.giftCharge(items).fund).toBeUndefined();
    expect(g.giftCharge(items).rows.length).toBeGreaterThan(1);
  });

  it("a gift given here stays paid after the site switches to the fund", () => {
    const rows = giftOwed(gift, "every");
    const paid = rows.map((r) => ({ partnerDonationId: `${ID}.${r.key}`, amount: r.donation }));
    expect(giftPaidMode(gift, paid)).toBe("every");
    expect(giftPaidMode(gift, paid.slice(1))).toBeNull();
  });
});
