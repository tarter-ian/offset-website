import { afterEach, describe, expect, it, vi } from "vitest";
import { chargeTotal, giftCharge, type GiftItem, giftOwed, giftPaidMode } from "./gifts";
import {
  autopayOffered,
  chargeSummary,
  EVERY_SLUGS,
  feeFor,
  FUND_KEY,
  fundGifts,
  owedPaid,
  paymentModeFrom,
  payRows,
  PLEDGE_EINS,
  pledgeCompleted,
  pledgeFormUrl,
  repeatRows,
} from "./payments";
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

describe("in Pledge mode", () => {
  it("builds each charity's form address with its exact amount, no tip and the plan's tags", () => {
    const u = new URL(pledgeFormUrl({ partnerKey: "pk_123", ein: "04-3512550", amount: 7.48, planId: "abc", gift: "carbon", brandColor: "#1d6b3d" }));
    expect(u.origin + u.pathname).toBe("https://www.pledge.to/widgets/donate/pk_123/ein/04-3512550");
    expect(u.searchParams.get("amount")).toBe("7.48");
    expect(u.searchParams.get("tip_rate")).toBe("0");
    expect(u.searchParams.get("style_brand_color")).toBe("#1d6b3d");
    expect(new URLSearchParams(u.searchParams.get("metadata")!).get("data-x-plan")).toBe("abc");
    expect(new URLSearchParams(u.searchParams.get("metadata")!).get("data-x-gift")).toBe("carbon");
  });

  // Every.org's $10 smallest gift breaks small per-charity gifts; Pledge took a $1 gift in Ian's test (2026-10-15).
  it("switches on only with both the mode and a partner key", () => {
    expect(paymentModeFrom("pledge", undefined, "pk_123")).toBe("pledge");
    expect(paymentModeFrom("pledge", undefined, undefined)).toBe("every");
    expect(paymentModeFrom("pledge", undefined, "  ")).toBe("every");
    expect(paymentModeFrom(undefined, undefined, "pk_123")).toBe("every");
    expect(paymentModeFrom("every", undefined, "pk_123")).toBe("every");
  });

  it("is the default once both are set, for gifts and the list alike", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_MODE", "pledge");
    vi.stubEnv("NEXT_PUBLIC_PLEDGE_PARTNER_KEY", "pk_test");
    vi.resetModules();
    const p = await import("./payments");
    const g = await import("./gifts");
    expect(p.PAYMENT_MODE).toBe("pledge");
    expect(g.giftCharge(items).fund).toBeUndefined();
    expect(g.giftCharge(items).rows.every((r) => r.fee === 0)).toBe(true);
  });

  it("stays on Every.org with the mode set but no partner key", async () => {
    vi.stubEnv("NEXT_PUBLIC_PAYMENT_MODE", "pledge");
    vi.stubEnv("NEXT_PUBLIC_PLEDGE_PARTNER_KEY", "");
    vi.resetModules();
    expect((await import("./payments")).PAYMENT_MODE).toBe("every");
  });

  it("has an EIN for every charity Every.org pays, shared the same way", () => {
    for (const k of Object.keys(EVERY_SLUGS) as (keyof typeof EVERY_SLUGS)[]) expect(PLEDGE_EINS[k]).toMatch(/^\d{2}-\d{7}$/);
    expect(PLEDGE_EINS.air).toBe(PLEDGE_EINS.carbon);
  });

  it("is one gift per charity with 25¢ minimums, the same charities as Every.org but no fee up to $1,000", () => {
    const c = giftCharge(items, C.birthYear, 1, "pledge");
    const e = giftCharge(items, C.birthYear, 1, "every");
    expect(c.fund).toBeUndefined();
    expect(c.rows.map((r) => r.key)).toEqual(e.rows.map((r) => r.key));
    expect(c.rows.every((r) => r.donation >= 0.25 && r.fee === 0 && r.total === r.donation)).toBe(true);
    const tiny = giftCharge([{ productId: "ai", span: "month" }], C.birthYear, 1, "pledge").rows;
    expect(tiny.length).toBeGreaterThan(0);
    expect(tiny.every((r) => r.donation >= 0.25)).toBe(true);
    expect(tiny.some((r) => r.donation < 1)).toBe(true);
    // Carbon and air go to Clean Air Task Force in one gift.
    const both = payRows({ ...split0(), carbon: { once: 0.2, perPeriod: 0 }, air: { once: 0.3, perPeriod: 0 } }, "monthly", false, "pledge");
    expect(both).toHaveLength(1);
    expect(both[0]).toMatchObject({ charity: "carbon", harms: ["carbon", "air"], donation: 0.5, fee: 0, total: 0.5 });
    // Same keys as Every.org's, so a gift is checked against the same records.
    const owed = (m: "pledge" | "every") => giftOwed({ ...gift, to: "Sam" }, m).map((r) => r.key);
    expect(owed("pledge")).toEqual(owed("every"));
    const split = harmSplit(planTotals(claim.lines, claim.ctx, claim.billing, claim.pastYears), claim.ctx, claim.billing);
    expect(planRows(claim, "pledge").map((r) => r.key)).toEqual(payRows(split, "monthly", false, "every").map((r) => r.key));
  });

  it("charges no fee at $1,000 or less, and the card fee above", () => {
    expect(feeFor(1, "pledge")).toBe(0);
    expect(feeFor(1000, "pledge")).toBe(0);
    expect(feeFor(1000.01, "pledge")).toBeGreaterThan(0);
    // 2.9% + 30¢, worked out on the whole payment so $2,000 arrives in full.
    const fee = feeFor(2000, "pledge");
    expect(2000 + fee - (0.3 + 0.029 * (2000 + fee))).toBeGreaterThanOrEqual(2000 - 0.005);
  });

  it("offers no autopay: no repeating rows even when asked, but still says what each month costs", () => {
    expect(autopayOffered("pledge")).toBe(false);
    expect(autopayOffered("every")).toBe(true);
    const s = { ...split0(), carbon: { once: 5, perPeriod: 2 }, water: { once: 0, perPeriod: 1 } };
    const rows = payRows(s, "monthly", true, "pledge");
    expect(rows.every((r) => r.frequency === "ONCE")).toBe(true);
    expect(rows).toEqual(payRows(s, "monthly", false, "pledge"));
    expect(repeatRows(s, "monthly", "pledge").map((r) => r.donation)).toEqual([2, 1]);
    expect(chargeSummary(s, "monthly", true, "pledge")).toEqual({ today: 8, then: 3 });
    expect(planRows({ ...claim, autopay: true }, "pledge").every((r) => !r.key.endsWith("-repeat"))).toBe(true);
  });

  it("reads Pledge's completion message only from Pledge, as a JSON string", () => {
    const msg = (data: object) => JSON.stringify({ message: "DonateCompleted", data });
    const fiat = { currencyType: "fiat", pending: false, currency: "usd", amount: "1.00", fees: null, tip: "0.15", total: "1.15" };
    expect(pledgeCompleted({ origin: "https://www.pledge.to", data: msg(fiat) })).toEqual({ amount: 1, fiat: true });
    expect(pledgeCompleted({ origin: "https://www.pledge.to", data: msg({ ...fiat, currencyType: "crypto" }) })).toEqual({ amount: 1, fiat: false });
    expect(pledgeCompleted({ origin: "https://evil.example", data: msg(fiat) })).toBeNull();
    expect(pledgeCompleted({ origin: "https://pledge.to", data: msg(fiat) })).toBeNull();
    expect(pledgeCompleted({ origin: "https://www.pledge.to", data: "{not json" })).toBeNull();
    expect(pledgeCompleted({ origin: "https://www.pledge.to", data: { message: "DonateCompleted", data: fiat } })).toBeNull();
    expect(pledgeCompleted({ origin: "https://www.pledge.to", data: JSON.stringify({ message: "Other", data: fiat }) })).toBeNull();
    expect(pledgeCompleted({ origin: "https://www.pledge.to", data: msg({ ...fiat, amount: "lots" }) })).toBeNull();
  });
});

function split0() {
  return {
    carbon: { once: 0, perPeriod: 0 },
    air: { once: 0, perPeriod: 0 },
    water: { once: 0, perPeriod: 0 },
    land: { once: 0, perPeriod: 0 },
    ewaste: { once: 0, perPeriod: 0 },
  };
}
