import { describe, expect, it } from "vitest";
import { offeredSecret, paidRows, parseEveryWebhook, safeEqual } from "./everyWebhook";

// Shaped like the example in docs.every.org/docs/webhooks/partner-webhook.
const body = {
  chargeId: "ch_123",
  partnerDonationId: "abcdefabcdef.carbon",
  partnerMetadata: { plan: "abcdefabcdef", row: "carbon" },
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  toNonprofit: { slug: "cleanaircatf", ein: "043512550", name: "Clean Air Task Force" },
  amount: "10.54",
  netAmount: "10.00",
  currency: "USD",
  frequency: "One-time",
  donationDate: "2026-10-12T15:00:00.000Z",
  paymentMethod: "card",
};

describe("parseEveryWebhook", () => {
  it("keeps what the donations table needs", () => {
    const r = parseEveryWebhook(body);
    expect(r).toEqual({
      ok: true,
      donation: {
        chargeId: "ch_123",
        partnerDonationId: "abcdefabcdef.carbon",
        nonprofit: "cleanaircatf",
        amount: 10.54,
        netAmount: 10,
        frequency: "One-time",
        email: "jane@example.com",
        createdAt: "2026-10-12T15:00:00.000Z",
      },
    });
  });

  it("allows a missing partner id and email, and a thousands comma", () => {
    const now = new Date("2026-10-12T00:00:00Z");
    const r = parseEveryWebhook({ ...body, partnerDonationId: undefined, email: null, amount: "1,000.00", donationDate: "soon" }, now);
    expect(r.ok && r.donation).toMatchObject({ partnerDonationId: null, email: null, amount: 1000, createdAt: now.toISOString() });
  });

  it("rejects bodies that aren't a donation", () => {
    for (const bad of [
      null,
      "hi",
      [],
      { ...body, chargeId: "" },
      { ...body, chargeId: 5 },
      { ...body, toNonprofit: {} },
      { ...body, amount: "ten" },
      { ...body, netAmount: "-1" },
      { ...body, currency: "EUR" },
      { ...body, frequency: "Weekly" },
      { ...body, partnerDonationId: 7 },
      { ...body, email: 7 },
    ]) {
      expect(parseEveryWebhook(bad).ok, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("webhook secret", () => {
  it("compares secrets exactly", async () => {
    expect(await safeEqual("s3cret", "s3cret")).toBe(true);
    expect(await safeEqual("s3cret", "s3cres")).toBe(false);
    expect(await safeEqual("s3cret", "s3cret ")).toBe(false);
    expect(await safeEqual("", "x")).toBe(false);
  });

  it("reads the secret from a bearer header or the URL", () => {
    expect(offeredSecret(new Request("https://x.org/api/every-webhook", { headers: { authorization: "Bearer abc" } }))).toBe("abc");
    expect(offeredSecret(new Request("https://x.org/api/every-webhook?secret=def"))).toBe("def");
    expect(offeredSecret(new Request("https://x.org/api/every-webhook"))).toBeNull();
  });
});

describe("paidRows", () => {
  it("returns a plan's row keys only, once each", () => {
    expect(paidRows("abcdefabcdef", ["abcdefabcdef.carbon", "abcdefabcdef.carbon", "abcdefabcdef.air-repeat", "other123other.water", null])).toEqual([
      "carbon",
      "air-repeat",
    ]);
    expect(paidRows("bad id", ["bad id.carbon"])).toEqual([]);
  });
});
