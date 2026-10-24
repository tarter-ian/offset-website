import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chargeTotal, giftCharge, type GiftItem, giftPaidMode } from "./gifts";
import { autopayOffered, chargeSummary, feeFor, onePayment, paymentModeFrom, payRows, PLEDGE_EINS, rowsTotal } from "./payments";
import { donationId, donationRequest, givePledgeDonation, orgLookupRequest, pickOrgId, PLEDGE_ORG_NAMES, pledgeApiHost, splitName } from "./pledgeApi";
import { minGift, PLEDGE_API_CARD_RATE, PLEDGE_API_FEE_RATE, STRIPE_CARD } from "./pricing";
import { parsePlanClaim, planRows } from "./publicList";
import { DEFAULT_CONTEXT as C, harmSplit, planTotals } from "./store";
import { lineItemName, parseSessionEvent, sessionForm, verifyStripeSignature } from "./stripe";

// "pledgeapi" mode (2026-10-24): one Stripe payment for every charity, then one Pledge
// donation per charity made by the server. Off by default.

const memory = vi.hoisted(() => ({ client: null as null | { execute: (s: { sql: string; args?: unknown[] }) => Promise<unknown> } }));
vi.mock("./db", async (orig) => {
  const real = await orig<typeof import("./db")>();
  return { ...real, db: async () => memory.client };
});

const ID = "abcdef0123456789abcd";
const lines = [
  { productId: "ai", amount: 10, cover: { past: true, ahead: "lifetime" as const } },
  { productId: "car", amount: 200, cover: { past: false, ahead: "monthly" as const } },
];
const claim = parsePlanClaim({ planId: ID, billing: "monthly", lines, ctx: C, pastYears: 0, autopay: false })!;
const split = harmSplit(planTotals(claim.lines, claim.ctx, claim.billing, claim.pastYears), claim.ctx, claim.billing);

describe("pledgeapi mode: rows and fees", () => {
  it("is chosen only by NEXT_PUBLIC_PAYMENT_MODE=pledgeapi", () => {
    expect(paymentModeFrom("pledgeapi", undefined)).toBe("pledgeapi");
    expect(paymentModeFrom(undefined, undefined)).toBe("every");
    expect(paymentModeFrom("pledge-api", undefined)).toBe("every");
  });

  it("has one row per charity, to the cent, with the same keys as Every.org and no fee of its own", () => {
    const rows = payRows(split, "monthly", false, "pledgeapi");
    expect(rows.map((r) => r.key)).toEqual(payRows(split, "monthly", false, "every").map((r) => r.key));
    for (const r of rows) {
      expect(r.fee).toBe(0);
      expect(r.total).toBe(r.donation);
      expect(Math.round(r.donation * 100)).toBeCloseTo(r.donation * 100, 6);
      expect(PLEDGE_EINS[r.charity]).toBeTruthy();
    }
    expect(minGift("pledgeapi")).toBe(0.01);
    // A share far under a dollar stays under a dollar, but any harm worth something keeps its row.
    const none = { once: 0, perPeriod: 0 };
    const tiny = payRows({ carbon: { once: 0.3, perPeriod: 0 }, air: none, water: none, land: none, ewaste: { once: 0.0001, perPeriod: 0 } }, "monthly", false, "pledgeapi");
    expect(tiny.map((r) => [r.charity, r.donation])).toEqual([["carbon", 0.3], ["ewaste", 0.01]]);
  });

  it("charges one payment whose fees leave every charity its part after Stripe and Pledge", () => {
    const rows = payRows(split, "monthly", false, "pledgeapi");
    const pay = onePayment(rows);
    const donation = Math.round(rows.reduce((s, r) => s + r.donation, 0) * 100) / 100;
    expect(pay.donation).toBe(donation);
    expect(pay.total).toBeCloseTo(pay.donation + pay.fee, 6);
    expect(pay.stripe + pay.pledge).toBeCloseTo(pay.fee, 6);
    // After Stripe's 2.9% + 30¢ on the payment, there is enough for the donations plus Pledge's 5% and 2.9% on them.
    const afterStripe = pay.total - (STRIPE_CARD.fixed + STRIPE_CARD.rate * pay.total);
    expect(afterStripe).toBeGreaterThanOrEqual(donation * (1 + PLEDGE_API_FEE_RATE + PLEDGE_API_CARD_RATE) - 0.01);
    expect(feeFor(donation, "pledgeapi")).toBe(pay.fee);
    expect(chargeSummary(split, "monthly", false, "pledgeapi").today).toBe(pay.total);
    expect(rowsTotal(rows, "pledgeapi")).toBe(pay.total);
    expect(onePayment([])).toEqual({ donation: 0, stripe: 0, pledge: 0, fee: 0, total: 0 });
  });

  it("offers no autopay, and the list checks the same rows checkout charges", () => {
    expect(autopayOffered("pledgeapi")).toBe(false);
    expect(payRows(split, "monthly", true, "pledgeapi").every((r) => r.frequency === "ONCE")).toBe(true);
    expect(planRows({ ...claim, autopay: true }, "pledgeapi")).toEqual(payRows(split, "monthly", false, "pledgeapi"));
  });

  it("charges a gift in one payment too, and counts it paid from Pledge's gifts", () => {
    const items: GiftItem[] = [{ productId: "ai", span: "month" }];
    const c = giftCharge(items, C.birthYear, 1, "pledgeapi");
    expect(c.fund).toBeUndefined();
    expect(chargeTotal(c, "pledgeapi")).toBe(onePayment(c.rows).total);
    const gift = { id: ID, items, birthYear: C.birthYear, to: "Sam" };
    const donations = c.rows.map((r) => ({ partnerDonationId: `${ID}.${r.key}`, amount: r.donation }));
    expect(giftPaidMode(gift, donations)).not.toBeNull();
  });
});

const SECRET = "whsec_test";
async function sign(body: string, t: number, secret = SECRET) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${body}`)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("Stripe signature", () => {
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const now = 1_790_000_000;

  it("accepts a valid signature, among others", async () => {
    const v1 = await sign(body, now);
    expect(await verifyStripeSignature(body, `t=${now},v1=${v1}`, SECRET, now)).toBe(true);
    expect(await verifyStripeSignature(body, `t=${now},v1=${"0".repeat(64)},v1=${v1},v0=abc`, SECRET, now + 60)).toBe(true);
  });

  it("refuses a bad signature, another secret or a changed body", async () => {
    const v1 = await sign(body, now);
    expect(await verifyStripeSignature(body, `t=${now},v1=${"ab".repeat(32)}`, SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, `t=${now},v1=${await sign(body, now, "other")}`, SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(`${body} `, `t=${now},v1=${v1}`, SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, `t=${now + 1},v1=${v1}`, SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, `t=${now},v1=nothex`, SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, null, SECRET, now)).toBe(false);
    expect(await verifyStripeSignature(body, `t=${now},v1=${v1}`, undefined, now)).toBe(false);
  });

  it("refuses a stale or future timestamp beyond five minutes", async () => {
    const old = now - 301;
    expect(await verifyStripeSignature(body, `t=${old},v1=${await sign(body, old)}`, SECRET, now)).toBe(false);
    const ahead = now + 301;
    expect(await verifyStripeSignature(body, `t=${ahead},v1=${await sign(body, ahead)}`, SECRET, now)).toBe(false);
    const ok = now - 299;
    expect(await verifyStripeSignature(body, `t=${ok},v1=${await sign(body, ok)}`, SECRET, now)).toBe(true);
  });
});

describe("Stripe session", () => {
  it("asks for one line item for the whole payment, in cents, tied to the plan", () => {
    const f = sessionForm({ referenceId: ID, source: "plan", charities: 4, amountCents: 1234, successUrl: "https://x.test/ok", cancelUrl: "https://x.test/back" });
    expect(f.get("mode")).toBe("payment");
    expect(f.get("line_items[0][price_data][unit_amount]")).toBe("1234");
    expect(f.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(f.get("line_items[0][price_data][product_data][name]")).toBe("Gifts to 4 charities through Pledge");
    expect(f.get("client_reference_id")).toBe(ID);
    expect(f.get("metadata[plan]")).toBe(ID);
    expect(lineItemName(1)).toBe("Gift to 1 charity through Pledge");
  });

  it("reads a completed session, and ignores other events", () => {
    const s = parseSessionEvent({
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { id: "cs_1", payment_status: "paid", amount_total: 1234, currency: "usd", client_reference_id: ID, customer_details: { email: "a@b.test", name: "Jane Q Doe" } } },
    });
    expect(s).toMatchObject({ sessionId: "cs_1", paid: true, amountCents: 1234, referenceId: ID, email: "a@b.test", name: "Jane Q Doe" });
    expect(parseSessionEvent({ type: "payment_intent.succeeded", data: { object: { id: "pi_1" } } })).toBeNull();
  });
});

describe("Pledge request builder", () => {
  it("picks the host, the sandbox only from an https PLEDGE_API_HOST", () => {
    expect(pledgeApiHost(undefined)).toBe("https://api.pledge.to");
    expect(pledgeApiHost("https://api-staging.pledge.to/")).toBe("https://api-staging.pledge.to");
    expect(pledgeApiHost("http://evil.test")).toBe("https://api.pledge.to");
  });

  it("looks a charity up by name and takes only the exact EIN match", () => {
    const r = orgLookupRequest("04-3512550", "key_1", "https://api.pledge.to");
    expect(r.url).toBe("https://api.pledge.to/v1/organizations?q=Clean+Air+Task+Force");
    expect(r.init.headers.authorization).toBe("Bearer key_1");
    const body = { results: [{ id: "x", ein: "04-3512551" }, { id: "org_9", ein: "043512550" }] };
    expect(pickOrgId(body, "04-3512550")).toBe("org_9");
    expect(pickOrgId({ results: [{ id: "x", ein: "11-1111111" }] }, "04-3512550")).toBeNull();
    expect(pickOrgId(null, "04-3512550")).toBeNull();
    // Pledge's real shape: the EIN is in ngo_id.
    const real = { page: 1, results: [{ id: "9d27", name: "CRUSH 04", ngo_id: "47-3285346" }, { id: "catf", name: "Clean Air Task Force", ngo_id: "04-3512550" }] };
    expect(pickOrgId(real, "04-3512550")).toBe("catf");
  });

  it("creates a donation with the amount as a decimal string and the donor's name split", () => {
    const r = donationRequest(
      { organizationId: "org_9", amount: 12.3, donor: { email: "a@b.test", ...splitName("Jane Q Doe") }, planId: ID, gift: "carbon", idempotencyKey: "cs_1.carbon" },
      "key_1",
      "https://api-staging.pledge.to",
    );
    expect(r.url).toBe("https://api-staging.pledge.to/v1/donations");
    expect(r.init.method).toBe("POST");
    expect(r.init.headers["idempotency-key"]).toBe("cs_1.carbon");
    expect(JSON.parse(r.init.body!)).toEqual({
      organization_id: "org_9",
      amount: "12.30",
      email: "a@b.test",
      first_name: "Jane",
      last_name: "Q Doe",
      metadata: { plan: ID, gift: "carbon" },
    });
    expect(donationId({ data: { id: 42 } })).toBe("42");
  });
});

// A fake Pledge: answers the lookup by name (with the EIN in ngo_id, as Pledge does), then each donation, failing any charity named in `failing`.
function fakePledge(failing: Set<string>) {
  const calls: string[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method} ${url}`);
    if (url.includes("/v1/organizations")) {
      const name = new URL(url).searchParams.get("q")!;
      const ein = Object.keys(PLEDGE_ORG_NAMES).find((e) => PLEDGE_ORG_NAMES[e] === name)!;
      return new Response(JSON.stringify({ results: [{ id: `org-${ein}`, name, ngo_id: ein }] }), { status: 200 });
    }
    const b = JSON.parse(String(init?.body)) as { organization_id: string; metadata: { gift: string } };
    if (failing.has(b.metadata.gift)) return new Response('{"error":"nope"}', { status: 500 });
    return new Response(JSON.stringify({ id: `don-${b.metadata.gift}` }), { status: 201 });
  }) as typeof fetch;
  return { fetcher, calls };
}

describe("settling a paid session", () => {
  beforeEach(async () => {
    const c = createClient({ url: ":memory:" });
    const dir = path.resolve(__dirname, "../../migrations");
    for (const f of readdirSync(dir).sort()) await c.executeMultiple(readFileSync(path.join(dir, f), "utf8"));
    memory.client = c as never;
  });

  it("gives each charity once, records a failure, and retries only that one when the event comes again", async () => {
    const { saveSession, settleSession, planChargeRows } = await import("./stripeStore");
    const { rowsOf } = await import("./db");
    const rows = planChargeRows(claim);
    const amountCents = Math.round(onePayment(rows).total * 100);
    await saveSession("cs_1", { source: "plan", sourceId: ID, rows, amountCents });
    const paid = { eventId: "evt_1", sessionId: "cs_1", paid: true, amountCents, currency: "usd", referenceId: ID, email: "a@b.test", name: "Jane Doe" };
    const failKey = rows[0].key;
    const first = fakePledge(new Set([failKey]));
    const a = await settleSession(paid, { apiKey: "k", host: "https://api-staging.pledge.to", fetcher: first.fetcher });
    expect(a).toEqual({ status: "given", confirmed: rows.length - 1, failed: 1 });
    const stored = rowsOf(await memory.client!.execute({ sql: "SELECT row_key, status, response FROM pledge_api_gifts ORDER BY row_key" }));
    expect(stored.find((r) => r.row_key === failKey)).toMatchObject({ status: "failed", response: '{"error":"nope"}' });
    const second = fakePledge(new Set());
    const b = await settleSession(paid, { apiKey: "k", host: "https://api-staging.pledge.to", fetcher: second.fetcher });
    expect(b).toEqual({ status: "given", confirmed: 1, failed: 0 });
    expect(second.calls.filter((c) => c.startsWith("POST"))).toHaveLength(1);
    // The confirmed gifts are where checkout and the list look for them.
    const ids = rowsOf(await memory.client!.execute({ sql: "SELECT partner_donation_id FROM donations" })).map((r) => r.partner_donation_id);
    expect(ids.sort()).toEqual(rows.map((r) => `${ID}.${r.key}`).sort());
    const c = await settleSession(paid, { apiKey: "k", fetcher: fakePledge(new Set()).fetcher });
    expect(c).toEqual({ status: "given", confirmed: 0, failed: 0 });
  });

  it("gives nothing when Stripe's total differs from the saved one, or the session is unknown", async () => {
    const { saveSession, settleSession, planChargeRows } = await import("./stripeStore");
    const rows = planChargeRows(claim);
    await saveSession("cs_2", { source: "plan", sourceId: ID, rows, amountCents: 999 });
    const base = { eventId: "e", paid: true, currency: "usd", referenceId: ID, email: "a@b.test", name: null };
    const { fetcher, calls } = fakePledge(new Set());
    expect((await settleSession({ ...base, sessionId: "cs_2", amountCents: 100 }, { apiKey: "k", fetcher })).status).toBe("mismatch");
    expect((await settleSession({ ...base, sessionId: "cs_x", amountCents: 999 }, { apiKey: "k", fetcher })).status).toBe("unknown");
    expect((await settleSession({ ...base, sessionId: "cs_2", amountCents: 999, paid: false }, { apiKey: "k", fetcher })).status).toBe("unpaid");
    expect(calls).toEqual([]);
  });

  it("never throws on a network error from Pledge", async () => {
    const boom = (async () => {
      throw new Error("offline");
    }) as typeof fetch;
    const r = await givePledgeDonation({ ein: "04-3512550", amount: 1, donor: { email: "a@b.test", firstName: "", lastName: "" }, planId: ID, gift: "carbon", idempotencyKey: "x" }, "k", "https://api.pledge.to", boom);
    expect(r.ok).toBe(false);
  });
});
