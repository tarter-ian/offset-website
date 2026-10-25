import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type CSSProperties } from "react";
import { CARBON_REMOVAL, CHARITIES } from "@/lib/charities";
import { IMPACT_INFO } from "@/lib/impacts";
import { LEDGER } from "@/lib/ledger";
import { arrivedAndFees, confirmedTotals, everyCharities } from "@/lib/ledgerLive";
import {
  CARD_FEE_LABEL,
  ENDAOMENT_GRANT_LABEL,
  ENDAOMENT_IN_LABEL,
  PLEDGE_API_CARD_LABEL,
  PLEDGE_API_FEE_LABEL,
  PLEDGE_FREE_LABEL,
  SPONSOR_FEE_LABEL,
  STRIPE_CARD_LABEL,
  usd,
} from "@/lib/pricing";
import { forMode, PAYMENT_MODE } from "@/lib/payments";

export const metadata: Metadata = { title: "Where the money goes | My Offset" };

// Totals come from the database, so the page is built on each visit.
export const dynamic = "force-dynamic";

const monthName = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

// The money's path as a picture: who holds it at each step, with each fee on the arrow it's taken from (Ian, 2026-10-25).
type Hop = { who: string; note: string; fee?: string };
const FLOW: Hop[] = forMode<Hop[]>({
  every: [
    { who: "You", note: "One gift per charity" },
    { who: "Every.org", note: "Nonprofit platform. Sends your tax receipt.", fee: `Card fee, ${CARD_FEE_LABEL}` },
    { who: "The charities", note: "Each gets its gift in full", fee: "Nothing kept" },
  ],
  pledge: [
    { who: "You", note: "One gift per charity" },
    { who: "Pledge", note: "Nonprofit platform. Emails your tax receipt.", fee: `No fee up to ${PLEDGE_FREE_LABEL}` },
    { who: "The charities", note: "Each gets its gift in full", fee: "Nothing kept" },
  ],
  pledgeapi: [
    { who: "You", note: "One payment for every charity" },
    { who: "Stripe", note: "Takes your card", fee: `Card fee, ${STRIPE_CARD_LABEL}` },
    { who: "Pledge", note: "Nonprofit platform. Records each gift in your name.", fee: `${PLEDGE_API_FEE_LABEL} + ${PLEDGE_API_CARD_LABEL} fees` },
    { who: "The charities", note: "Each gets its part in full", fee: "Nothing kept" },
  ],
  endaoment: [
    { who: "You", note: "One gift to My Offset's fund" },
    { who: "Endaoment", note: "Nonprofit fund. Sends your tax receipt.", fee: `${ENDAOMENT_IN_LABEL} in, plus card fee` },
    { who: "The charities", note: "Each gets its part", fee: `${ENDAOMENT_GRANT_LABEL} as it's granted` },
  ],
  sponsor: [
    { who: "You", note: "One payment" },
    { who: "My charity sponsor", note: "Registered charity. Sends your tax receipt.", fee: `Card fee + ${SPONSOR_FEE_LABEL}` },
    { who: "The charities", note: "Paid once a month", fee: "Nothing kept" },
  ],
});

export default async function LedgerPage() {
  // In endaoment mode these are the gifts made for someone else, which still go through Every.org.
  const live = PAYMENT_MODE === "sponsor" ? [] : await confirmedTotals();
  const charities = everyCharities();
  const removal = LEDGER.filter((e) => e.cause === "removal").reduce((sum, e) => sum + e.usd, 0);
  const all = arrivedAndFees(live);
  const months = [...new Set(live.map((t) => t.month))];
  const nameOf = (slug: string) => charities.find((c) => c.slug === slug)?.name ?? slug;

  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">Where the money goes</h1>
      <p className="mt-4 text-lg text-muted">
        {forMode({
          every: "Each gift appears here once Every.org confirms it.",
          endaoment: "Each gift appears here once I can confirm it.",
          pledge: "Each gift appears here once I can confirm it with Pledge.",
          pledgeapi: "Each gift appears here once Pledge confirms it.",
          sponsor: "Each gift appears here once it reaches the charity.",
        })}
      </p>

      {/* The path of a dollar, left to right on wide screens and top to bottom on phones. */}
      <section id="sponsor" aria-label="How a gift reaches the charities" className="mt-8 scroll-mt-6">
        {/* Equal boxes with the fee arrows between them: a grid on wide screens, a stack on phones. */}
        <ol
          className="grid gap-2 md:items-stretch md:gap-0 md:[grid-template-columns:var(--flow-cols)]"
          style={{ "--flow-cols": FLOW.map((_, i) => (i === 0 ? "minmax(0,1fr)" : "6.5rem minmax(0,1fr)")).join(" ") } as CSSProperties}
        >
            {FLOW.map((h) => (
              <Fragment key={h.who}>
                {h.fee && (
                  <li aria-hidden="true" className="flex items-center gap-2 py-1 pl-4 text-sm text-muted md:flex-col md:justify-center md:gap-1 md:px-2 md:py-0 md:text-center">
                    <span className="text-lg text-foreground md:hidden">↓</span>
                    <span className="hidden text-lg text-foreground md:block">→</span>
                    <span>{h.fee}</span>
                  </li>
                )}
                <li className="border-t-[6px] border-rule bg-card px-4 py-3">
                  <p className="font-semibold">{h.who}</p>
                  <p className="mt-1 text-sm text-muted">{h.note}</p>
                  {h.fee && <p className="sr-only">Fee on the way: {h.fee}</p>}
                </li>
              </Fragment>
            ))}
        </ol>
        <p className="mt-3 text-sm text-muted">I keep nothing, and I&apos;ll say so here before any of this changes.</p>
      </section>

      <h2 className="mt-12 text-xl font-semibold">Given so far</h2>
      <table className="mt-3 w-full border-t-2 border-rule text-left">
        <thead>
          <tr className="border-b border-border text-sm text-muted">
            <th className="py-2 font-medium">For</th>
            <th className="py-2 font-medium">Charity</th>
            <th className="py-2 pr-4 text-right font-medium">Arrived</th>
            <th className="py-2 text-right font-medium">Card fees</th>
          </tr>
        </thead>
        <tbody>
          {charities.map((c) => (
            <tr key={c.slug} className="border-b border-border align-top">
              <td className="py-3 pr-4">{c.harms.map((k) => IMPACT_INFO[k].label).join(" and ")}</td>
              <td className="py-3 pr-4">
                <a href={c.url} target="_blank" rel="noreferrer" className="underline hover:text-muted">
                  {c.name}
                </a>
                <span className="block text-sm text-muted">{CHARITIES[c.harms[0]].focus}</span>
              </td>
              <td className="py-3 pr-4 text-right font-mono">{usd(arrivedAndFees(live, c.slug).arrived)}</td>
              <td className="py-3 text-right font-mono">{usd(arrivedAndFees(live, c.slug).fees)}</td>
            </tr>
          ))}
          {removal > 0 && (
            <tr className="border-b border-border align-top">
              <td className="py-3 pr-4">Carbon removal</td>
              <td className="py-3 pr-4">
                <a href={CARBON_REMOVAL.url} target="_blank" rel="noreferrer" className="underline hover:text-muted">
                  {CARBON_REMOVAL.name}
                </a>
              </td>
              <td className="py-3 pr-4 text-right font-mono">{usd(removal)}</td>
              <td className="py-3 text-right font-mono">{usd(0)}</td>
            </tr>
          )}
          <tr className="border-b-2 border-rule font-semibold">
            <td className="py-3" colSpan={2}>
              {all.arrived + removal > 0 ? "Total" : "No gifts yet"}
            </td>
            <td className="py-3 pr-4 text-right font-mono">{usd(all.arrived + removal)}</td>
            <td className="py-3 text-right font-mono">{usd(all.fees)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-sm text-muted">
        {forMode({
          every: "Arrived is what reached each charity after Every.org's card fees, as Every.org reports each gift. Card fees are what the card processor kept.",
          pledge: "Arrived is what reached each charity, once I can confirm the gift with Pledge. Card fees are what the card processor kept.",
          pledgeapi: "Arrived is each gift Pledge made in your name. The Stripe and Pledge fees paid on top of it aren't counted here yet.",
          endaoment: "So far this is gifts made for someone else, through Every.org. Gifts to the Endaoment fund are added once I can confirm them.",
          sponsor: "Arrived is what reached each charity. Card fees are what the card processor kept.",
        })}{" "}
        Nothing about who gave is shown.
      </p>

      {months.length > 0 && (
        <>
          <h2 className="mt-12 text-xl font-semibold">By month</h2>
          {months.map((m) => (
            <div key={m} className="mt-4">
              <p className="font-display font-bold">{monthName(m)}</p>
              <ul className="mt-1 space-y-1">
                {live
                  .filter((t) => t.month === m)
                  .map((t) => (
                    <li key={`${m}-${t.slug}`} className="flex justify-between gap-4 border-b border-border py-1">
                      <span>
                        {nameOf(t.slug)}{" "}
                        <span className="text-sm text-muted">
                          · {t.gifts} gift{t.gifts === 1 ? "" : "s"}
                        </span>
                      </span>
                      <span className="text-right font-mono">
                        {usd(t.net)} <span className="text-sm text-muted">+ {usd(Math.max(0, t.usd - t.net))} fees</span>
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </>
      )}

      <p id="running" className="mt-12 scroll-mt-6">
        I pay the site&apos;s running costs myself, about $15 a year for the web address, with hosting free at this size. None of your
        donation goes to them, and I offset the site&apos;s own footprint too.
      </p>

      <p className="mt-10 text-muted">
        See <Link href="/promises" className="text-accent underline underline-offset-4">my promises</Link> and{" "}
        <Link href="/method" className="text-accent underline underline-offset-4">how it&apos;s calculated</Link>.
      </p>
    </article>
  );
}
