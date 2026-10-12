import type { Metadata } from "next";
import Link from "next/link";
import { CARBON_REMOVAL, CHARITIES } from "@/lib/charities";
import { IMPACT_INFO } from "@/lib/impacts";
import { LEDGER } from "@/lib/ledger";
import { confirmedTotals, everyCharities } from "@/lib/ledgerLive";
import { SPONSOR_FEE_LABEL, usd } from "@/lib/pricing";
import { PAYMENT_MODE } from "@/lib/payments";

export const metadata: Metadata = { title: "Where the money goes | My Offset" };

// Totals come from the database, so the page is built on each visit.
export const dynamic = "force-dynamic";

const monthName = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

const STEPS = PAYMENT_MODE === "every" ? [
  { title: "You give", body: "You give to each charity on your plan through Every.org, one gift per charity. Each gift shows its own card fee at checkout." },
  { title: "Every.org", body: "Every.org, a nonprofit donation platform, takes the payment, sends you the tax receipt and passes the gift to the charity. We never hold the money ourselves." },
  { title: "The charities", body: "Each charity gets your gift from Every.org. The card fee goes to the card processor. We keep nothing; tips are separate and pay for running the site." },
] : [
  { title: "You pay", body: "Your donation, the card fee and the sponsor fee are listed separately at checkout." },
  { title: "Our charity sponsor", body: "A registered charity holds your donation and sends you the tax receipt. My Offset is one of its projects, so we never hold the money ourselves. It keeps the sponsor fee for that work." },
  { title: "The charities", body: "The sponsor pools small donations and pays each charity on your summary once a month. The card fee goes to the card processor. We keep only tips people choose to add, which pay for running the site." },
];

// What tips pay for. Rough monthly costs of keeping the site up; amounts are list prices.
const RUNNING_COSTS = [
  {
    what: "Covering this site's own footprint: hosting and every page load, worked out the same way as yours (Ian covers the AI used to build it himself)",
    cost: "first, each month; pennies at our size",
  },
  { what: "Hosting the site (Cloudflare)", cost: "free up to 100,000 visits a day, then $5 a month" },
  { what: "The web address", cost: "about $15 a year" },
  { what: "Database for saved plans (Cloudflare D1)", cost: "free at our size for now" },
  { what: "Listing the browser extension in the Chrome Web Store", cost: "$5, once" },
];

export default async function LedgerPage() {
  const live = PAYMENT_MODE === "every" ? await confirmedTotals() : [];
  const charities = everyCharities();
  const givenTo = (slug: string) => live.filter((t) => t.slug === slug).reduce((sum, t) => sum + t.usd, 0);
  const removal = LEDGER.filter((e) => e.cause === "removal").reduce((sum, e) => sum + e.usd, 0);
  const total = live.reduce((sum, t) => sum + t.usd, 0) + removal;
  const months = [...new Set(live.map((t) => t.month))];
  const nameOf = (slug: string) => charities.find((c) => c.slug === slug)?.name ?? slug;

  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">Where the money goes</h1>
      <p className="mt-4 text-lg text-muted">
        Every dollar given through this site, to every charity, as Every.org confirms it. Updated as gifts arrive.
      </p>

      <dl className="mt-8 border-t-2 border-rule">
        {STEPS.map((s) => (
          <div key={s.title} className="grid gap-1 border-b border-border py-3 sm:grid-cols-[12rem_1fr] sm:gap-6">
            <dt className="font-semibold">{s.title}</dt>
            <dd>{s.body}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-12 text-xl font-semibold">Given so far</h2>
      <table className="mt-3 w-full border-t-2 border-rule text-left">
        <thead>
          <tr className="border-b border-border text-sm text-muted">
            <th className="py-2 font-medium">For</th>
            <th className="py-2 font-medium">Charity</th>
            <th className="py-2 text-right font-medium">Given</th>
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
              <td className="py-3 text-right font-mono">{usd(givenTo(c.slug))}</td>
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
              <td className="py-3 text-right font-mono">{usd(removal)}</td>
            </tr>
          )}
          <tr className="border-b-2 border-rule font-semibold">
            <td className="py-3" colSpan={2}>
              Total
            </td>
            <td className="py-3 text-right font-mono">{usd(total)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-sm text-muted">
        Amounts are what people paid on Every.org, card fees included, as its webhook reports each gift. Nothing about who gave is shown.
      </p>

      {months.length === 0 ? (
        <p className="mt-4 text-muted">Nothing yet: the first confirmed gifts show up here by month as soon as they arrive.</p>
      ) : (
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
                      <span className="font-mono">{usd(t.usd)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </>
      )}

      {PAYMENT_MODE === "every" ? (
        <>
          <h2 id="sponsor" className="mt-12 scroll-mt-6 text-xl font-semibold">How payments work</h2>
          <p className="mt-2 text-muted">
            My Offset isn&apos;t a charity of its own, so for now you give to each charity directly through Every.org, a free 501(c)(3)
            donation platform. Each charity is paid separately through Every.org, which charges card payments 2.2% + 30¢ and bank
            payments nothing. Every.org sends your tax receipt and pays the charity, and may ask for an optional tip for itself. Later
            we may move to a fiscal sponsor, a registered charity that would hold donations and pay the charities each month. We&apos;ll
            say so here before that changes.
          </p>
        </>
      ) : (
        <>
      <h2 id="sponsor" className="mt-12 scroll-mt-6 text-xl font-semibold">Our charity sponsor</h2>
      <p className="mt-2 text-muted">
        My Offset isn&apos;t a charity of its own, so a registered charity runs it as one of its projects. That&apos;s called fiscal
        sponsorship. The sponsor holds every donation, sends your tax receipt, checks the charities qualify and pays them each month.
        For that it keeps {SPONSOR_FEE_LABEL} of each payment, shown as its own line at checkout. We&apos;ll name the sponsor here once
        the agreement is signed.
      </p>
        </>
      )}

      <h2 id="tips" className="mt-12 scroll-mt-6 text-xl font-semibold">What tips pay for</h2>
      <p className="mt-2 text-muted">
        Tips are optional and separate from your donation.{" "}
        {PAYMENT_MODE === "every" && "Every.org only pays charities, so tips go through a page of their own, linked at checkout. "}
        They pay only for keeping My Offset running, starting with covering the site&apos;s own footprint; nobody draws a salary from them.
      </p>
      <ul className="mt-3 border-t-2 border-rule">
        {RUNNING_COSTS.map((c) => (
          <li key={c.what} className="flex justify-between gap-4 border-b border-border py-2">
            <span>{c.what}</span>
            <span className="text-right font-mono text-sm">{c.cost}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-muted">
        Tips received and what they were spent on go up here each month, next to the donations. Anything left over after a month&apos;s
        costs goes to the charities with that month&apos;s donations, split the same way the donations were: a charity that got 40% of
        the month&apos;s donations gets 40% of the leftover tips.
      </p>

      <p className="mt-10 text-muted">
        See <Link href="/promises" className="text-accent hover:underline">our promises</Link> and{" "}
        <Link href="/method" className="text-accent hover:underline">how we calculate</Link>.
      </p>
    </article>
  );
}
