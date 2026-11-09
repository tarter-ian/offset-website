// Stripe, for "pledgeapi" mode: the donor's one payment to My Offset, through a
// Stripe Checkout Session made with Stripe's REST API (no SDK, so it runs on
// Cloudflare Workers as is), and Stripe's signed webhook when it's paid.

export const STRIPE_API = "https://api.stripe.com/v1";
export const STRIPE_SIGNATURE_HEADER = "Stripe-Signature";
/** Stripe's own default: a signed event older than five minutes is refused, so an old one can't be replayed. */
export const STRIPE_TOLERANCE_S = 300;
/** Larger than any checkout event should be; anything bigger isn't read. */
export const STRIPE_MAX_BODY = 256 * 1024;
/** Stripe's smallest charge in US dollars. */
export const STRIPE_MIN_USD = 0.5;

const fromHex = (s: string): Uint8Array<ArrayBuffer> | null => {
  if (!/^(?:[0-9a-f]{2})+$/i.test(s)) return null;
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(2 * i, 2 * i + 2), 16);
  return out;
};

/**
 * Whether a webhook's Stripe-Signature header ("t=<unix seconds>,v1=<hex>[,v1=...]") signs
 * this raw body under the endpoint's secret: HMAC-SHA256 of "<t>.<body>", with t no more than
 * five minutes from now. Web Crypto's HMAC verify compares in constant time.
 */
export async function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string | undefined,
  nowS: number = Math.floor(Date.now() / 1000),
  toleranceS: number = STRIPE_TOLERANCE_S,
): Promise<boolean> {
  if (!secret || !header) return false;
  let t: string | null = null;
  const sigs: string[] = [];
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "t") t = v;
    else if (k === "v1") sigs.push(v);
  }
  if (!t || !/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(nowS - Number(t)) > toleranceS) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signed = enc.encode(`${t}.${rawBody}`);
  for (const s of sigs) {
    const sig = fromHex(s);
    if (sig && sig.length === 32 && (await crypto.subtle.verify("HMAC", key, sig, signed))) return true;
  }
  return false;
}

/** "Gifts to 4 charities through Pledge", the one line on Stripe's page. */
export const lineItemName = (charities: number) => (charities === 1 ? "Gift to 1 charity through Pledge" : `Gifts to ${charities} charities through Pledge`);

export interface SessionInput {
  /** The plan's or gift's id. */
  referenceId: string;
  source: "plan" | "gift";
  charities: number;
  amountCents: number;
  successUrl: string;
  cancelUrl: string;
  /**
   * Autopay (Ian, 2026-10-25): the part charged again each month or year, in cents, and how
   * often. It must be part of amountCents; the rest is charged once, today.
   */
  repeat?: { cents: number; interval: "month" | "year"; pastUntil?: string | null };
}

/**
 * The form body of POST /v1/checkout/sessions, in US dollars. Without autopay it's one
 * payment, one line item. With autopay it's a subscription: a repeating line item for the
 * part charged each month or year, and a one-time line item for the rest of today's payment,
 * so today's charge is still amountCents.
 */
export function sessionForm(i: SessionInput): URLSearchParams {
  const f = new URLSearchParams();
  const repeat = i.repeat && i.repeat.cents > 0 && i.repeat.cents <= i.amountCents ? i.repeat : null;
  f.set("mode", repeat ? "subscription" : "payment");
  if (!repeat) f.set("submit_type", "donate");
  const item = (n: number, cents: number, name: string, interval?: "month" | "year") => {
    f.set(`line_items[${n}][quantity]`, "1");
    f.set(`line_items[${n}][price_data][currency]`, "usd");
    f.set(`line_items[${n}][price_data][unit_amount]`, String(cents));
    f.set(`line_items[${n}][price_data][product_data][name]`, name);
    if (interval) f.set(`line_items[${n}][price_data][recurring][interval]`, interval);
  };
  if (repeat) {
    item(0, repeat.cents, `${lineItemName(i.charities)}, each ${repeat.interval}`, repeat.interval);
    if (i.amountCents > repeat.cents) item(1, i.amountCents - repeat.cents, `${lineItemName(i.charities)}, once`);
    f.set("subscription_data[metadata][plan]", i.referenceId);
  } else {
    item(0, i.amountCents, lineItemName(i.charities));
    f.set("payment_intent_data[metadata][plan]", i.referenceId);
  }
  f.set("client_reference_id", i.referenceId);
  f.set("metadata[plan]", i.referenceId);
  f.set("metadata[source]", i.source);
  f.set("success_url", i.successUrl);
  f.set("cancel_url", i.cancelUrl);
  return f;
}

/** Creates the Checkout Session. Returns its id and the address to send the donor to. Never throws. */
export async function createCheckoutSession(
  form: URLSearchParams,
  secretKey: string,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: true; id: string; url: string } | { ok: false; status: number; error: string }> {
  try {
    const res = await fetcher(`${STRIPE_API}/checkout/sessions`, {
      method: "POST",
      headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const body = (await res.json().catch(() => null)) as { id?: unknown; url?: unknown; error?: { message?: unknown } } | null;
    if (res.ok && typeof body?.id === "string" && typeof body.url === "string") return { ok: true, id: body.id, url: body.url };
    return { ok: false, status: res.status, error: typeof body?.error?.message === "string" ? body.error.message : "Stripe refused the session." };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

/** What the webhook reads from a paid Checkout Session. */
export interface PaidSession {
  eventId: string;
  sessionId: string;
  paid: boolean;
  amountCents: number;
  currency: string;
  referenceId: string | null;
  email: string | null;
  name: string | null;
  /** The autopay subscription the session started, if any. */
  subscriptionId?: string | null;
}

const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

/** A Checkout Session event, or null for any other event type. */
export function parseSessionEvent(body: unknown): PaidSession | null {
  const e = body as { id?: unknown; type?: unknown; data?: { object?: Record<string, unknown> } } | null;
  if (!e || typeof e.type !== "string" || !PAID_EVENTS.has(e.type)) return null;
  const s = e.data?.object;
  if (!s || typeof s.id !== "string") return null;
  const cd = (s.customer_details ?? null) as { email?: unknown; name?: unknown } | null;
  const meta = (s.metadata ?? null) as { plan?: unknown } | null;
  const ref = typeof s.client_reference_id === "string" ? s.client_reference_id : typeof meta?.plan === "string" ? meta.plan : null;
  return {
    eventId: typeof e.id === "string" ? e.id : "",
    sessionId: s.id,
    paid: s.payment_status === "paid",
    amountCents: typeof s.amount_total === "number" ? s.amount_total : -1,
    currency: typeof s.currency === "string" ? s.currency : "",
    referenceId: ref,
    email: typeof cd?.email === "string" && cd.email ? cd.email : null,
    name: typeof cd?.name === "string" && cd.name ? cd.name : null,
    subscriptionId: typeof s.subscription === "string" ? s.subscription : null,
  };
}

/** An autopay invoice event: a renewal that was paid, or one coming up. */
export interface InvoiceEvent {
  eventId: string;
  type: "paid" | "upcoming";
  /** Stripe's invoice id; an upcoming invoice has none yet. */
  invoiceId: string | null;
  subscriptionId: string;
  /** Only renewals are given here; the first payment is given from its Checkout Session. */
  renewal: boolean;
  amountCents: number;
  currency: string;
  email: string | null;
  name: string | null;
  /** When the upcoming charge is due, as an ISO date, if Stripe says. */
  dueAt: string | null;
}

/**
 * invoice.paid or invoice.upcoming for a subscription, or null for anything else. Reads the
 * subscription from where older and newer Stripe API versions put it.
 */
export function parseInvoiceEvent(body: unknown): InvoiceEvent | null {
  const e = body as { id?: unknown; type?: unknown; data?: { object?: Record<string, unknown> } } | null;
  if (!e || (e.type !== "invoice.paid" && e.type !== "invoice.upcoming")) return null;
  const inv = e.data?.object;
  if (!inv) return null;
  const parent = (inv.parent ?? null) as { subscription_details?: { subscription?: unknown } } | null;
  const sub = typeof inv.subscription === "string" ? inv.subscription : typeof parent?.subscription_details?.subscription === "string" ? parent.subscription_details.subscription : null;
  if (!sub) return null;
  const paid = e.type === "invoice.paid";
  const amount = paid ? inv.amount_paid : inv.amount_due;
  const due = typeof inv.next_payment_attempt === "number" ? inv.next_payment_attempt : typeof inv.period_end === "number" ? inv.period_end : null;
  return {
    eventId: typeof e.id === "string" ? e.id : "",
    type: paid ? "paid" : "upcoming",
    invoiceId: typeof inv.id === "string" ? inv.id : null,
    subscriptionId: sub,
    renewal: inv.billing_reason === "subscription_cycle",
    amountCents: typeof amount === "number" ? amount : -1,
    currency: typeof inv.currency === "string" ? inv.currency : "",
    email: typeof inv.customer_email === "string" && inv.customer_email ? inv.customer_email : null,
    name: typeof inv.customer_name === "string" && inv.customer_name ? inv.customer_name : null,
    dueAt: due ? new Date(due * 1000).toISOString() : null,
  };
}

/** A subscription that ended (customer.subscription.deleted): its id, or null for anything else. */
export function parseSubscriptionEnded(body: unknown): string | null {
  const e = body as { type?: unknown; data?: { object?: { id?: unknown } } } | null;
  return e?.type === "customer.subscription.deleted" && typeof e.data?.object?.id === "string" ? e.data.object.id : null;
}

/**
 * Whether a Stripe event and the Pledge host are on different sides: a test-mode payment
 * must never make a real Pledge gift (billed to Ian's card), and a real payment must never
 * go to Pledge's sandbox, where no charity gets anything. Reads the event's top-level livemode.
 */
export function modeMismatch(event: unknown, pledgeHost: string, liveHost: string): boolean {
  const live = (event as { livemode?: unknown } | null)?.livemode;
  if (typeof live !== "boolean") return true;
  return live !== (pledgeHost === liveHost);
}

/**
 * When autopay should end for a plan that spreads past use over `years`: a day before the
 * charge that would come after the last instalment, so that charge is never made.
 */
export function pastPaidOff(start: Date, years: number): Date {
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + years * 12);
  end.setUTCDate(end.getUTCDate() - 1);
  return end;
}

/** Sets an autopay subscription to end on its own at `at`, with no charge for part of a period. Never throws. */
export async function endSubscriptionAt(
  subscriptionId: string,
  at: Date,
  secretKey: string,
  fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; error?: string }> {
  const f = new URLSearchParams();
  f.set("cancel_at", String(Math.floor(at.getTime() / 1000)));
  f.set("proration_behavior", "none");
  try {
    const res = await fetcher(`${STRIPE_API}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "POST",
      headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/x-www-form-urlencoded" },
      body: f.toString(),
    });
    if (res.ok) return { ok: true };
    const body = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null;
    return { ok: false, error: typeof body?.error?.message === "string" ? body.error.message : `Stripe answered ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}
