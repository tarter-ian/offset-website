import type { Metadata } from "next";
import Link from "next/link";
import { ComputerOnly } from "@/components/ComputerOnly";
import { CARBON_REMOVAL, CHARITIES } from "@/lib/charities";
import { IMPACT_INFO } from "@/lib/impacts";
import { LEDGER } from "@/lib/ledger";
import { arrivedAndFees, confirmedTotals, everyCharities } from "@/lib/ledgerLive";
import {
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

const STEPS = PAYMENT_MODE === "every" ? [
  { title: "You give", body: "You give to each charity on your plan through Every.org, one gift per charity. Each gift shows its own card fee at checkout." },
  { title: "Every.org", body: "Every.org, a nonprofit donation platform, takes the payment, sends you the tax receipt and passes the gift to the charity. I never hold the money myself." },
  { title: "The charities", body: "Each charity gets your gift from Every.org. The card fee goes to the card processor. I keep nothing." },
] : PAYMENT_MODE === "pledge" ? [
  { title: "You give", body: `You give to each charity on your plan through Pledge, one gift per charity, in a form on this site. Pledge pays the card fee on gifts up to ${PLEDGE_FREE_LABEL}.` },
  { title: "Pledge", body: "Pledge, a nonprofit giving platform, takes the payment, emails you the tax receipt and passes the gift to the charity. I never hold the money myself. Pledge may ask for an optional tip, which goes to Pledge. My Offset gets none of it." },
  { title: "The charities", body: "Each charity gets your gift from Pledge. Any card fee goes to the card processor. I keep nothing." },
] : PAYMENT_MODE === "pledgeapi" ? [
  { title: "You pay", body: `You pay My Offset once, through Stripe, for every charity on your plan. Checkout shows each charity's part and every fee. Stripe keeps its card fee, ${STRIPE_CARD_LABEL}.` },
  { title: "Pledge", body: `I pass every dollar of your donation to Pledge, a nonprofit giving platform, as one gift per charity in your name. Pledge keeps its ${PLEDGE_API_FEE_LABEL} technology fee and ${PLEDGE_API_CARD_LABEL} card fee, which your payment covers on top.` },
  { title: "The charities", body: "Each charity gets its part from Pledge, in full. The fees go to Stripe and Pledge. I keep nothing." },
] : PAYMENT_MODE === "endaoment" ? [
  { title: "You give", body: "You make one gift to My Offset's fund at Endaoment. Checkout shows each charity's part and every fee." },
  { title: "Endaoment", body: `Endaoment, a nonprofit that runs charitable funds, takes the payment, sends you the tax receipt and holds the gift in the fund. I never hold the money myself. It keeps ${ENDAOMENT_IN_LABEL} as a gift comes in and ${ENDAOMENT_GRANT_LABEL} as it grants it out.` },
  { title: "The charities", body: "Endaoment grants each charity its part from the fund. The card fee goes to the card processor. I keep nothing." },
] : [
  { title: "You pay", body: "Your donation, the card fee and the sponsor fee are listed separately at checkout." },
  { title: "My charity sponsor", body: "A registered charity holds your donation and sends you the tax receipt. My Offset is one of its projects, so I never hold the money myself. It keeps the sponsor fee for that work." },
  { title: "The charities", body: "The sponsor pools small donations and pays each charity on your summary once a month. The card fee goes to the card processor. I keep nothing." },
];

// What running the site costs, which Ian pays himself (no tips, Ian 2026-10-13); amounts are list prices.
const RUNNING_COSTS = [
  {
    what: "Offsetting this site's own footprint: hosting and every page load, worked out the same way as yours (I offset the AI used to build it myself)",
    cost: "each month; pennies at this size",
  },
  { what: "Hosting the site (Cloudflare)", cost: "free up to 100,000 visits a day, then $5 a month" },
  { what: "The web address", cost: "about $15 a year" },
  { what: "Database for saved plans (Cloudflare D1)", cost: "free at this size for now" },
  // Phones never mention the extension (Ian, 2026-10-13).
  { what: "Listing the browser extension in the Chrome Web Store", cost: "$5, once", computer: true },
];

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
          every: "Every dollar given through this site, to every charity, as Every.org confirms it. Updated as gifts arrive.",
          endaoment: "Every dollar given through this site that I can confirm, to every charity. Updated as gifts arrive.",
          pledge: "Every dollar given through this site that I can confirm, to every charity. Updated as gifts arrive.",
          pledgeapi: "Every dollar given through this site, to every charity, as Pledge confirms each gift. Updated as gifts arrive.",
          sponsor: "Every dollar given through this site, to every charity, as Every.org confirms it. Updated as gifts arrive.",
        })}
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
              Total
            </td>
            <td className="py-3 pr-4 text-right font-mono">{usd(all.arrived + removal)}</td>
            <td className="py-3 text-right font-mono">{usd(all.fees)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-sm text-muted">
        Arrived is what reached each charity after Every.org&apos;s card fees, as its webhook reports each gift; card fees are what the
        card processor kept. Nothing about who gave is shown.
        {PAYMENT_MODE === "endaoment" &&
          " So far that's gifts made for someone else. Gifts to the Endaoment fund are added once I can confirm them with Endaoment."}
        {PAYMENT_MODE === "pledge" && " Gifts made through Pledge are added once I can confirm them with Pledge."}
        {PAYMENT_MODE === "pledgeapi" &&
          " For gifts I make through Pledge, arrived is the gift itself; the Stripe and Pledge fees paid on top of it aren't counted in this table yet."}
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

      {PAYMENT_MODE === "every" ? (
        <>
          <h2 id="sponsor" className="mt-12 scroll-mt-6 text-xl font-semibold">How payments work</h2>
          <p className="mt-2 text-muted">
            My Offset isn&apos;t a charity of its own, so for now you give to each charity directly through Every.org, a free 501(c)(3)
            donation platform. Each charity is paid separately through Every.org, which charges card payments 2.2% + 30¢ and bank
            payments nothing. Every.org sends your tax receipt and pays the charity. It may ask for a tip for itself; you can set it to $0 on its page, and I never see it. Later
            I may move to a fiscal sponsor, a registered charity that would hold donations and pay the charities each month. I&apos;ll
            say so here before that changes.
          </p>
        </>
      ) : PAYMENT_MODE === "pledge" ? (
        <>
          <h2 id="sponsor" className="mt-12 scroll-mt-6 text-xl font-semibold">How payments work</h2>
          <p className="mt-2 text-muted">
            My Offset isn&apos;t a charity of its own, so you give to each charity directly through Pledge, a nonprofit giving platform
            run by Pledgeling Foundation, a 501(c)(3). Each charity&apos;s form opens on this site with its amount filled in. Pledge pays
            the card fee on gifts up to {PLEDGE_FREE_LABEL}; above that, the card fee is added on top. Pledge emails your tax receipt
            and pays the charity. It may ask for an optional tip, which goes to Pledge, and I never see it. I&apos;ll say so here before
            any of this changes.
          </p>
        </>
      ) : PAYMENT_MODE === "pledgeapi" ? (
        <>
          <h2 id="sponsor" className="mt-12 scroll-mt-6 text-xl font-semibold">How payments work</h2>
          <p className="mt-2 text-muted">
            My Offset isn&apos;t a charity of its own. You pay me once, through Stripe, and I give each charity its part through Pledge, a
            nonprofit giving platform run by Pledgeling Foundation, a 501(c)(3). I pass on every dollar of your donation. Stripe keeps
            its card fee ({STRIPE_CARD_LABEL}), and Pledge keeps its {PLEDGE_API_FEE_LABEL} technology fee and {PLEDGE_API_CARD_LABEL} card
            fee; checkout shows each one, added on top. Pledge records each gift in your name. I&apos;ll say so here before any of this
            changes.
          </p>
        </>
      ) : PAYMENT_MODE === "endaoment" ? (
        <>
          <h2 id="sponsor" className="mt-12 scroll-mt-6 text-xl font-semibold">How payments work</h2>
          <p className="mt-2 text-muted">
            My Offset isn&apos;t a charity of its own, so you give to My Offset&apos;s fund at Endaoment, a 501(c)(3) nonprofit that runs
            charitable funds. You make one gift; Endaoment sends your tax receipt and grants each charity its part. It keeps{" "}
            {ENDAOMENT_IN_LABEL} as a gift comes in and {ENDAOMENT_GRANT_LABEL} as it is granted out, and there&apos;s a card fee too; checkout
            shows each one, added on top. Gifts made for someone else still go to each charity through Every.org.
          </p>
        </>
      ) : (
        <>
      <h2 id="sponsor" className="mt-12 scroll-mt-6 text-xl font-semibold">My charity sponsor</h2>
      <p className="mt-2 text-muted">
        My Offset isn&apos;t a charity of its own, so a registered charity runs it as one of its projects. That&apos;s called fiscal
        sponsorship. The sponsor holds every donation, sends your tax receipt, checks the charities qualify and pays them each month.
        For that it keeps {SPONSOR_FEE_LABEL} of each payment, shown as its own line at checkout. I&apos;ll name the sponsor here once
        the agreement is signed.
      </p>
        </>
      )}

      <h2 id="running" className="mt-12 scroll-mt-6 text-xl font-semibold">Running the site</h2>
      <p className="mt-2 text-muted">
        I made My Offset and pay these myself. There are no tips, and none of your donation goes to them.
      </p>
      <ul className="mt-3 border-t-2 border-rule">
        {RUNNING_COSTS.map((c) => {
          const row = (
            <li key={c.what} className="flex justify-between gap-4 border-b border-border py-2">
              <span>{c.what}</span>
              <span className="text-right font-mono text-sm">{c.cost}</span>
            </li>
          );
          return "computer" in c ? <ComputerOnly key={c.what}>{row}</ComputerOnly> : row;
        })}
      </ul>

      <p className="mt-10 text-muted">
        See <Link href="/promises" className="text-accent underline underline-offset-4">my promises</Link> and{" "}
        <Link href="/method" className="text-accent underline underline-offset-4">how it&apos;s calculated</Link>.
      </p>
    </article>
  );
}
