import { PLAN_ID } from "./payments";

// Every.org's partner webhook: a POST with a JSON body for each donation made
// through our donate links (docs.every.org/docs/webhooks/partner-webhook). The
// docs describe no signature, so the webhook URL carries a shared secret that
// only we and Every.org's dashboard know.

export interface Donation {
  chargeId: string;
  partnerDonationId: string | null;
  nonprofit: string;
  amount: number;
  netAmount: number;
  frequency: string;
  email: string | null;
  createdAt: string;
}

export type Parsed = { ok: true; donation: Donation } | { ok: false; error: string };

const FREQUENCIES = new Set(["One-time", "Monthly", "Yearly"]);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const money = (v: unknown) => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d[\d,]*(\.\d+)?$/.test(v.trim()) ? Number(v.trim().replace(/,/g, "")) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Checks a partner webhook body and pulls out what we keep. Amounts arrive as strings in dollars. */
export function parseEveryWebhook(body: unknown, now: Date = new Date()): Parsed {
  if (!isObj(body)) return { ok: false, error: "Body isn't a JSON object." };
  const { chargeId, partnerDonationId, toNonprofit, amount, netAmount, currency, frequency, email, donationDate } = body;
  if (typeof chargeId !== "string" || !chargeId.trim() || chargeId.length > 200) return { ok: false, error: "Missing chargeId." };
  if (!isObj(toNonprofit) || typeof toNonprofit.slug !== "string" || !toNonprofit.slug) return { ok: false, error: "Missing toNonprofit.slug." };
  const gross = money(amount);
  const net = money(netAmount);
  if (gross === null || net === null) return { ok: false, error: "Amounts must be numbers." };
  if (currency !== undefined && currency !== "USD") return { ok: false, error: "Only USD is accepted." };
  if (typeof frequency !== "string" || !FREQUENCIES.has(frequency)) return { ok: false, error: "Unknown frequency." };
  if (partnerDonationId !== undefined && partnerDonationId !== null && (typeof partnerDonationId !== "string" || partnerDonationId.length > 200))
    return { ok: false, error: "Bad partnerDonationId." };
  if (email !== undefined && email !== null && typeof email !== "string") return { ok: false, error: "Bad email." };
  const date = typeof donationDate === "string" && !Number.isNaN(Date.parse(donationDate)) ? new Date(donationDate) : now;
  return {
    ok: true,
    donation: {
      chargeId: chargeId.trim(),
      partnerDonationId: typeof partnerDonationId === "string" && partnerDonationId ? partnerDonationId : null,
      nonprofit: toNonprofit.slug,
      amount: gross,
      netAmount: net,
      frequency,
      email: typeof email === "string" && email ? email : null,
      createdAt: date.toISOString(),
    },
  };
}

/** Compares two secrets in time that doesn't depend on where they differ, by comparing their SHA-256 digests. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(a)), crypto.subtle.digest("SHA-256", enc.encode(b))]);
  const ax = new Uint8Array(x);
  const by = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ax.length; i++) diff |= ax[i] ^ by[i];
  return diff === 0;
}

/** The secret a request offers: a bearer token, or ?secret= on the URL set in Every.org's dashboard. */
export function offeredSecret(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return new URL(req.url).searchParams.get("secret");
}

/** Row keys of a plan's gifts, from their partner donation ids ("<plan>.<row>"). */
export function paidRows(planId: string, ids: (string | null)[]): string[] {
  if (!PLAN_ID.test(planId)) return [];
  const prefix = `${planId}.`;
  return [...new Set(ids.filter((id): id is string => !!id && id.startsWith(prefix)).map((id) => id.slice(prefix.length)))];
}
