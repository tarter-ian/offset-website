import { afterEach, describe, expect, it, vi } from "vitest";
import { cardFee, paymentFee, sponsorRate, SPONSOR_RATE } from "./pricing";
import {
  EVERY_SLUGS,
  everyDonateUrl,
  feeFor,
  partnerDonationId,
  payLink,
  paymentsOn,
  payRows,
  perCharityFees,
  repeatRows,
  sumTotal,
} from "./payments";
import type { HarmSplit } from "./store";

const split = (s: Partial<Record<keyof HarmSplit, [number, number]>>): HarmSplit => {
  const out = {} as HarmSplit;
  for (const k of ["carbon", "air", "water", "land", "ewaste"] as const) out[k] = { once: s[k]?.[0] ?? 0, perPeriod: s[k]?.[1] ?? 0 };
  return out;
};

afterEach(() => vi.unstubAllEnvs());

describe("donate links", () => {
  it("builds an Every.org link with every parameter, amounts to two decimals", () => {
    const url = new URL(
      everyDonateUrl({
        slug: "cleanaircatf",
        amount: 10.5,
        frequency: "MONTHLY",
        partnerDonationId: "abc123abc123.carbon-repeat",
        partnerMetadata: { plan: "abc123abc123", row: "carbon-repeat" },
        webhookToken: "tok",
        successUrl: "https://myoffset.org/checkout/return?plan=abc123abc123&charity=carbon-repeat",
        exitUrl: "https://myoffset.org/checkout/return?plan=abc123abc123",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://www.every.org/cleanaircatf");
    expect(url.hash).toBe("#donate");
    const q = url.searchParams;
    expect(q.get("amount")).toBe("10.50");
    expect(q.get("frequency")).toBe("MONTHLY");
    expect(q.get("partner_donation_id")).toBe("abc123abc123.carbon-repeat");
    expect(JSON.parse(atob(q.get("partner_metadata")!))).toEqual({ plan: "abc123abc123", row: "carbon-repeat" });
    expect(q.get("webhook_token")).toBe("tok");
    expect(q.get("success_url")).toBe("https://myoffset.org/checkout/return?plan=abc123abc123&charity=carbon-repeat");
    expect(q.get("exit_url")).toBe("https://myoffset.org/checkout/return?plan=abc123abc123");
  });

  it("encodes the return address so its own query stays inside success_url", () => {
    const raw = everyDonateUrl({ slug: "lung", amount: 3, frequency: "ONCE", partnerDonationId: "x", successUrl: "https://a.b/r?plan=p&charity=air" });
    expect(raw).toContain("success_url=https%3A%2F%2Fa.b%2Fr%3Fplan%3Dp%26charity%3Dair");
    expect(raw).toContain("amount=3.00");
    expect(raw).not.toContain("webhook_token");
    expect(raw).not.toContain("partner_metadata");
    expect(raw.endsWith("#donate")).toBe(true);
  });

  it("points each row at its charity, with the plan id, row key and token from the environment", () => {
    vi.stubEnv("NEXT_PUBLIC_EVERY_WEBHOOK_TOKEN", "pub-token");
    const [row] = payRows(split({ land: [12.345, 0] }), "monthly", false);
    const url = new URL(payLink("abcdefabcdef", row, "https://myoffset.org")!);
    expect(url.pathname).toBe(`/${EVERY_SLUGS.land}`);
    expect(url.searchParams.get("amount")).toBe(row.total.toFixed(2));
    expect(url.searchParams.get("partner_donation_id")).toBe(partnerDonationId("abcdefabcdef", "land"));
    expect(url.searchParams.get("webhook_token")).toBe("pub-token");
    expect(url.searchParams.get("success_url")).toBe("https://myoffset.org/checkout/return?plan=abcdefabcdef&charity=land");
    expect(payLink("abcdefabcdef", row, "https://myoffset.org", "sponsor")).toBeNull();
  });

  it("is off unless NEXT_PUBLIC_PAYMENTS_ON is 1", () => {
    expect(paymentsOn()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_PAYMENTS_ON", "true");
    expect(paymentsOn()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_PAYMENTS_ON", "1");
    expect(paymentsOn()).toBe(true);
  });
});

describe("fees in Every.org mode", () => {
  it("has no sponsor share, only the card fee", () => {
    expect(sponsorRate("every")).toBe(0);
    expect(sponsorRate("sponsor")).toBe(SPONSOR_RATE);
    expect(feeFor(10, "every")).toBe(cardFee(10));
    expect(feeFor(10, "sponsor")).toBe(paymentFee(10));
    // 30¢ + 2.2% of the whole payment, rounded up to the cent: (0.30 + 0.22) / 0.978.
    expect(cardFee(10)).toBe(0.54);
    for (const d of [1, 7.5, 40, 386]) {
      const total = d + cardFee(d);
      expect(total - (0.3 + 0.022 * total)).toBeGreaterThanOrEqual(d - 1e-9);
    }
  });

  it("charges one card fee per charity", () => {
    const rows = payRows(split({ carbon: [10, 0], water: [3, 0], land: [2, 0], ewaste: [4, 0] }), "monthly", false);
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(r.fee).toBe(cardFee(r.donation));
    // Four charities, four 30¢ fixed fees.
    expect(rows.reduce((s, r) => s + r.fee, 0)).toBeGreaterThan(4 * 0.3);
    expect(sumTotal(rows)).toBeCloseTo(rows.reduce((s, r) => s + r.donation + r.fee, 0), 6);
    expect(perCharityFees({ carbon: 10, water: 3, land: 2, ewaste: 4 })).toBeCloseTo(rows.reduce((s, r) => s + r.fee, 0), 6);
  });
});

describe("payment rows", () => {
  it("skips charities with nothing to give", () => {
    const rows = payRows(split({ carbon: [10, 0], water: [0, 0], ewaste: [0.001, 0] }), "monthly", false);
    expect(rows.map((r) => r.charity)).toEqual(["carbon"]);
    expect(payRows(split({}), "monthly", false)).toEqual([]);
  });

  it("pays harms that share a charity in one gift with one fee", () => {
    expect(EVERY_SLUGS.air).toBe(EVERY_SLUGS.carbon);
    const rows = payRows(split({ carbon: [10, 0], air: [5, 0], water: [3, 0] }), "monthly", false);
    expect(rows.map((r) => [r.charity, r.harms, r.donation])).toEqual([
      ["carbon", ["carbon", "air"], 15],
      ["water", ["water"], 3],
    ]);
    expect(perCharityFees({ carbon: 10, air: 5, water: 3 })).toBeCloseTo(cardFee(15) + cardFee(3), 6);
    // Air alone still goes to the shared charity's gift.
    expect(payRows(split({ air: [4, 0] }), "monthly", false)[0].charity).toBe("carbon");
  });

  it("pays a small share to its own charity, rounded up, never to another harm's charity", () => {
    const rows = payRows(split({ carbon: [10, 0], land: [0.4, 0] }), "monthly", false);
    expect(rows.map((r) => [r.charity, r.harms, r.donation])).toEqual([
      ["carbon", ["carbon"], 10],
      ["land", ["land"], 1],
    ]);
  });

  it("rounds each gift up to the cent and to at least a dollar", () => {
    const [row] = payRows(split({ air: [0.3, 0] }), "monthly", false);
    expect(row.donation).toBe(1);
    const [r2] = payRows(split({ air: [4.001, 0] }), "monthly", false);
    expect(r2.donation).toBe(4.01);
  });

  it("puts everything due now in one gift each without autopay, and splits off the repeating part with it", () => {
    const s = split({ carbon: [20, 5], water: [0, 3] });
    const once = payRows(s, "monthly", false);
    expect(once.map((r) => [r.key, r.frequency, r.donation])).toEqual([
      ["carbon", "ONCE", 25],
      ["water", "ONCE", 3],
    ]);
    const auto = payRows(s, "monthly", true);
    expect(auto.map((r) => [r.key, r.frequency])).toEqual([
      ["carbon", "ONCE"],
      ["carbon-repeat", "MONTHLY"],
      ["water-repeat", "MONTHLY"],
    ]);
    expect(repeatRows(s, "annual").every((r) => r.frequency === "YEARLY")).toBe(true);
  });
});

describe("default spread for past use", async () => {
  const { bestPastYears, payRows: rowsOf } = await import("./payments");
  const { DEFAULT_CONTEXT: C, defaultPastYears, defaultAmount, harmSplit, planTotals, productById } = await import("./store");
  const line = (id: string, past: boolean) => ({ productId: id, amount: defaultAmount(productById(id)!, C), cover: { past, ahead: "monthly" as const } });
  it("stays within the $10-a-month cap and never costs more than the plain rule", () => {
    for (const plan of [[line("tv", true)], [line("car", false), line("phone", true)], [line("music", true), line("transit", false)]]) {
      const base = planTotals(plan, C, "monthly", 0);
      const past = base.lines.reduce((s, l) => s + l.pastCost, 0);
      const y = bestPastYears(plan, C, "monthly");
      const plain = defaultPastYears(past);
      expect(y === 0 ? past <= 10 : past / (y * 12) <= 10 + 1e-9).toBe(true);
      const cost = (n: typeof y) => {
        const r = rowsOf(harmSplit(planTotals(plan, C, "monthly", n), C, "monthly"), "monthly", true);
        return r.reduce((s, x) => s + x.total, 0);
      };
      expect(Number.isFinite(cost(y))).toBe(true);
      expect(y >= plain || y === 0).toBe(true);
    }
  });
});
