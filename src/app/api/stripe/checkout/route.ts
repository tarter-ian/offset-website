import { NextResponse } from "next/server";
import { NoDatabaseError } from "@/lib/db";
import { loadGift } from "@/lib/giftStore";
import { onePayment, PAYMENT_MODE, paymentsOn } from "@/lib/payments";
import { parsePlanClaim, sameRows } from "@/lib/publicList";
import { planTotals } from "@/lib/store";
import { createCheckoutSession, pastPaidOff, sessionForm, STRIPE_MIN_USD } from "@/lib/stripe";
import { giftChargeRows, planChargeRows, repeatPart, saveSession } from "@/lib/stripeStore";

export const dynamic = "force-dynamic";

/**
 * Starts the one Stripe payment for a plan or a gift, in "pledgeapi" mode. The amount is
 * worked out here again: for a plan from its lines (and checked against the rows the
 * browser showed, as the public list does), for a gift from the gift as it was saved.
 * Nothing the browser says about money is used. Answers with Stripe's page to go to.
 */
export async function POST(req: Request) {
  if (!paymentsOn() || PAYMENT_MODE !== "pledgeapi") return NextResponse.json({ error: "Paying through Stripe isn't on." }, { status: 404 });
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error("stripe-checkout: STRIPE_SECRET_KEY isn't set");
    return NextResponse.json({ error: "Payments aren't ready yet. Try again later." }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > 64_000) return NextResponse.json({ error: "Too big." }, { status: 413 });
    body = JSON.parse(raw);
    if (typeof body !== "object" || body === null) throw new Error();
  } catch {
    return NextResponse.json({ error: "Body isn't JSON." }, { status: 400 });
  }
  const origin = new URL(req.url).origin;
  let source: "plan" | "gift";
  let sourceId: string;
  let rows;
  let returnPath: string;
  // Autopay (Ian, 2026-10-25): plans only, and only when the donor turned it on and part of the plan repeats.
  let interval: "month" | "year" = "month";
  // When a plan spreads past use over years, autopay ends once that's paid off (Ian, 2026-10-26).
  let pastUntil: string | null = null;
  try {
    if (body.source === "gift") {
      const found = typeof body.giftId === "string" ? await loadGift(body.giftId) : null;
      if (!found) return NextResponse.json({ error: "Unknown gift." }, { status: 404 });
      if (found.paid) return NextResponse.json({ error: "This gift is already given." }, { status: 409 });
      source = "gift";
      sourceId = found.gift.id;
      rows = giftChargeRows(found.gift);
      returnPath = `/gift/${sourceId}`;
    } else {
      const input = parsePlanClaim(body);
      if (!input) return NextResponse.json({ error: "That plan doesn't add up." }, { status: 400 });
      rows = planChargeRows(input);
      if (!sameRows(rows, body.rows)) return NextResponse.json({ error: "The plan changed; reload and try again." }, { status: 409 });
      source = "plan";
      sourceId = input.planId;
      interval = input.billing === "annual" ? "year" : "month";
      const spread = planTotals(input.lines, input.ctx, input.billing, input.pastYears).pastSpread;
      if (spread) pastUntil = pastPaidOff(new Date(), spread.years).toISOString();
      returnPath = "/checkout/return";
    }
  } catch (e) {
    console.error("stripe-checkout: couldn't load", e instanceof NoDatabaseError ? "no database" : e);
    return NextResponse.json({ error: "Couldn't look it up." }, { status: 503 });
  }
  if (!rows.length) return NextResponse.json({ error: "Nothing to give." }, { status: 400 });
  const pay = onePayment(rows);
  if (pay.total < STRIPE_MIN_USD) return NextResponse.json({ error: "Stripe's smallest payment is 50¢. Add a little more to your plan." }, { status: 400 });
  const amountCents = Math.round(pay.total * 100);
  const again = source === "plan" ? repeatPart(rows) : [];
  const repeat = again.length ? { cents: Math.round(onePayment(again).total * 100), interval, pastUntil } : null;
  const back = (paid: boolean) => `${origin}${returnPath}?plan=${encodeURIComponent(sourceId)}${paid ? "&paid=stripe" : ""}`;
  const made = await createCheckoutSession(
    sessionForm({ referenceId: sourceId, source, charities: rows.length, amountCents, successUrl: back(true), cancelUrl: back(false), ...(repeat ? { repeat } : {}) }),
    secret,
  );
  if (!made.ok) {
    console.error("stripe-checkout: Stripe refused", made.status, made.error);
    return NextResponse.json({ error: "Stripe couldn't start the payment. Try again in a minute." }, { status: 502 });
  }
  try {
    await saveSession(made.id, { source, sourceId, rows, amountCents, repeat });
  } catch (e) {
    // Without the saved session the webhook couldn't give the gifts, so the donor isn't sent to pay.
    console.error("stripe-checkout: couldn't save session", e instanceof NoDatabaseError ? "no database" : e);
    return NextResponse.json({ error: "Couldn't save the payment. Try again in a minute." }, { status: 503 });
  }
  return NextResponse.json({ url: made.url });
}
