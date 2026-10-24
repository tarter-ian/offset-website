import { NextResponse } from "next/server";
import { NoDatabaseError } from "@/lib/db";
import { pledgeApiHost } from "@/lib/pledgeApi";
import { parseSessionEvent, STRIPE_MAX_BODY, STRIPE_SIGNATURE_HEADER, verifyStripeSignature } from "@/lib/stripe";
import { settleSession } from "@/lib/stripeStore";

export const dynamic = "force-dynamic";

/**
 * Stripe's webhook, for "pledgeapi" mode. The Stripe-Signature header is checked
 * against the raw body with STRIPE_WEBHOOK_SECRET. When a Checkout Session is paid,
 * each charity's gift is made through Pledge's API and recorded (see settleSession).
 *
 * A failed Pledge call is recorded and still answered 200, so Stripe doesn't send the
 * whole event again on its own. To retry the failed gifts, resend the event from the
 * Stripe dashboard (Developers, Events): gifts already confirmed are skipped. Only a
 * database error answers 503, which asks Stripe to try again later.
 */
export async function POST(req: Request) {
  const body = await req.text();
  if (body.length > STRIPE_MAX_BODY) return NextResponse.json({ error: "Too large." }, { status: 413 });
  if (!(await verifyStripeSignature(body, req.headers.get(STRIPE_SIGNATURE_HEADER), process.env.STRIPE_WEBHOOK_SECRET))) {
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }
  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Body isn't JSON." }, { status: 400 });
  }
  const session = parseSessionEvent(event);
  if (!session) return NextResponse.json({ ok: true, ignored: true });
  try {
    const settled = await settleSession(session, { apiKey: process.env.PLEDGE_API_KEY, host: pledgeApiHost() });
    // Only ids and counts are logged, never the donor's email or name.
    if (settled.status === "unknown" || settled.status === "mismatch" || settled.failed)
      console.error("stripe-webhook:", settled.status, session.sessionId, `confirmed ${settled.confirmed}, failed ${settled.failed}`);
    return NextResponse.json({ ok: true, ...settled });
  } catch (e) {
    console.error("stripe-webhook: couldn't settle", e instanceof NoDatabaseError ? "no database" : e);
    return NextResponse.json({ error: "Couldn't store it." }, { status: 503 });
  }
}
