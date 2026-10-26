import { NextResponse } from "next/server";
import { NoDatabaseError } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { PLEDGE_API_LIVE, pledgeApiHost } from "@/lib/pledgeApi";
import { usd } from "@/lib/pricing";
import {
  modeMismatch,
  parseInvoiceEvent,
  parseSessionEvent,
  parseSubscriptionEnded,
  STRIPE_MAX_BODY,
  STRIPE_SIGNATURE_HEADER,
  verifyStripeSignature,
} from "@/lib/stripe";
import { claimReminder, endSubscription, settleRenewal, settleSession } from "@/lib/stripeStore";

export const dynamic = "force-dynamic";

/**
 * Stripe's webhook, for "pledgeapi" mode. The Stripe-Signature header is checked
 * against the raw body with STRIPE_WEBHOOK_SECRET. When a Checkout Session is paid,
 * each charity's gift is made through Pledge's API and recorded (see settleSession).
 *
 * Autopay (Ian, 2026-10-25) adds three events, which the endpoint must be sent too:
 * - invoice.paid: a renewal was charged, so that period's gifts are made (settleRenewal).
 *   The first invoice is skipped; its gifts come from the Checkout Session.
 * - invoice.upcoming: a reminder email a few days before each renewal, with the amount and
 *   the link to stop (STRIPE_PORTAL_URL, Stripe's customer portal login link). Stripe sends it
 *   only when "upcoming renewal events" is on in its Billing settings.
 * - customer.subscription.deleted: autopay was stopped, so no more renewals are given.
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
  const pledge = { apiKey: process.env.PLEDGE_API_KEY, host: pledgeApiHost(), stripeKey: process.env.STRIPE_SECRET_KEY };
  try {
    const ended = parseSubscriptionEnded(event);
    if (ended) {
      await endSubscription(ended);
      return NextResponse.json({ ok: true, ended: true });
    }

    const invoice = parseInvoiceEvent(event);
    if (invoice) {
      if (invoice.type === "upcoming") {
        const due = await claimReminder(invoice.subscriptionId, invoice.dueAt);
        if (due && invoice.email) {
          const when = invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" }) : "soon";
          const stop = process.env.STRIPE_PORTAL_URL;
          await sendEmail(
            invoice.email,
            `Your My Offset autopay of ${usd(due.amountCents / 100)} is on ${when}`,
            [
              `On ${when}, autopay will charge ${usd(due.amountCents / 100)} for this ${due.interval}'s gifts to your charities, fees included.`,
              "",
              ...(due.last
                ? [
                    "This is the last autopay charge. After it, your past use is fully offset, so autopay ends on its own and nothing more is charged.",
                    "",
                    `To keep offsetting your ongoing use, come back to ${new URL(req.url).origin} and turn autopay on again. It costs less now, since only your ongoing use is left.`,
                    "",
                  ]
                : []),
              stop ? `To stop autopay, or change your card: ${stop}` : "To stop autopay, reply to this email and I'll cancel it.",
              "",
              "Ian, My Offset",
            ].join("\n"),
          );
        }
        return NextResponse.json({ ok: true, reminded: !!due });
      }
      if (!invoice.renewal || !invoice.invoiceId) return NextResponse.json({ ok: true, ignored: true });
      if (modeMismatch(event, pledge.host, PLEDGE_API_LIVE)) {
        console.error("stripe-webhook: Stripe and Pledge modes differ; renewal not given", invoice.invoiceId);
        return NextResponse.json({ ok: false, error: "Stripe test mode and Pledge's live API (or the other way round); nothing given." });
      }
      const settled = await settleRenewal({ ...invoice, invoiceId: invoice.invoiceId }, pledge);
      if (settled.status !== "given" || settled.failed)
        console.error("stripe-webhook: renewal", settled.status, invoice.invoiceId, `confirmed ${settled.confirmed}, failed ${settled.failed}`);
      return NextResponse.json({ ok: true, ...settled });
    }

    const session = parseSessionEvent(event);
    if (!session) return NextResponse.json({ ok: true, ignored: true });
    // A test payment never gives through live Pledge, and a real one never through the sandbox.
    if (modeMismatch(event, pledge.host, PLEDGE_API_LIVE)) {
      console.error("stripe-webhook: Stripe and Pledge modes differ; nothing given", session.sessionId);
      return NextResponse.json({ ok: false, error: "Stripe test mode and Pledge's live API (or the other way round); nothing given." });
    }
    const settled = await settleSession(session, pledge);
    // Only ids and counts are logged, never the donor's email or name.
    if (settled.status === "unknown" || settled.status === "mismatch" || settled.failed)
      console.error("stripe-webhook:", settled.status, session.sessionId, `confirmed ${settled.confirmed}, failed ${settled.failed}`);
    return NextResponse.json({ ok: true, ...settled });
  } catch (e) {
    console.error("stripe-webhook: couldn't settle", e instanceof NoDatabaseError ? "no database" : e);
    return NextResponse.json({ error: "Couldn't store it." }, { status: 503 });
  }
}
