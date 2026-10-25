import type { Metadata } from "next";
import Link from "next/link";
import { ComputerOnly } from "@/components/ComputerOnly";
import { forMode, PAYMENT_MODE } from "@/lib/payments";
import { ENDAOMENT_GRANT_LABEL, ENDAOMENT_IN_LABEL, PLEDGE_API_CARD_LABEL, PLEDGE_API_FEE_LABEL } from "@/lib/pricing";

export const metadata: Metadata = { title: "What's different | My Offset" };

// Each row: what offset apps usually do, and what we do instead. Keep claims about others general and sourced.
// `computer` is shown only where the extension can be installed.
type Row = {
  topic: string;
  usual: string;
  /** The difference in a few words, shown in bold (Ian, 2026-10-25). */
  claim: string;
  /** One sentence that backs the claim. */
  ours: string;
  source?: { href: string; text: string };
  link?: { href: string; text: string };
  computer?: { text: string; link?: { href: string; text: string } };
};
// The rows a skeptic cares about most come first.
const ROWS: Row[] = [
  {
    topic: "How much reaches charity",
    usual: "A share is kept to run the company. One well-known subscription app reports sending about 80% to projects.",
    source: { href: "https://blog.wren.co/posts/wren-financial-report-year-two", text: "Wren, year two report" },
    claim: "All of your donation",
    ours: forMode({
      every: "The only fee is Every.org's card fee, shown for each charity, and I pay for running the site myself.",
      pledge: "Pledge pays the card fee on gifts up to $1,000, so most gifts have no fee, and I pay for running the site myself.",
      pledgeapi: `The only fees are Stripe's card fee and Pledge's ${PLEDGE_API_FEE_LABEL} and ${PLEDGE_API_CARD_LABEL} fees, each on its own line, and I pay for running the site myself.`,
      endaoment: `The only fees are the card payment and Endaoment's ${ENDAOMENT_IN_LABEL} in and ${ENDAOMENT_GRANT_LABEL} out, each on its own line, and I pay for running the site myself.`,
      sponsor: "The only fees are the card payment and my charity sponsor's share, each on its own line, and I pay for running the site myself.",
    }),
    link: { href: "/ledger", text: "Where the money goes" },
  },
  {
    topic: "What counts as harm",
    usual: "Carbon only.",
    claim: "Five kinds of harm",
    ours: "Carbon, air pollution, water used up, land taken from nature and e-waste, each paid to a charity that works on it.",
    link: { href: "/method", text: "How it's calculated" },
  },
  {
    topic: "Where the money goes",
    usual: "Often cheap carbon credits, many of which have been found not to deliver.",
    claim: "Charities chosen on evidence",
    ours: forMode({
      every: "I buy no carbon credits. Every month's totals are public, and Every.org emails you the receipt for each gift.",
      endaoment: "I buy no carbon credits. Every month's totals are public, and Endaoment emails you the receipt.",
      pledge: "I buy no carbon credits. Every month's totals are public, and Pledge emails you the receipt for each gift.",
      pledgeapi: "I buy no carbon credits. Every month's totals are public, and Pledge records each gift in your name.",
      sponsor: "I buy no carbon credits. Every month's totals are public, and my charity sponsor emails you the receipt.",
    }),
  },
  {
    topic: "How your footprint is found",
    usual: "A questionnaire about your home, car and diet, matched to national averages.",
    claim: "Measured from your accounts",
    ours: "Link ChatGPT, Claude, YouTube and other services and I count what you actually used. The questions are there if you'd rather not link.",
    link: { href: "/", text: "See your real numbers" },
  },
  {
    topic: "Your AI use",
    usual: "Left out, or one line for \"digital\".",
    claim: "Counted prompt by prompt",
    ours: "Images, video, the AI built into search and apps, and a share of training the models all count too.",
    computer: { text: "The free browser extension I made does the counting on your computer.", link: { href: "/extension", text: "About the extension" } },
  },
  {
    topic: "Paying",
    usual: "A monthly charge that renews until you cancel, or one-off credits for a single flight.",
    claim: "Once, or when you choose",
    ours:
      PAYMENT_MODE === "every"
        ? "AI, internet and devices can be offset for life in one gift. For the rest, you approve each payment and can skip any month; autopay is there if you want it, off by default."
        : PAYMENT_MODE === "sponsor"
        ? "AI, internet and devices can be offset for life in one gift. For the rest, you approve each payment and can skip any month; autopay is off by default, with an email before every charge."
        : "AI, internet and devices can be offset for life in one gift. For the rest, you approve each payment and can skip any month, and nothing repeats on its own.",
  },
  {
    topic: "Choosing what to offset",
    usual: "One plan for your whole footprint.",
    claim: "Item by item",
    ours: "Pick from AI chat to flights to the food you eat, and add only what you want.",
    link: { href: "/", text: "Browse items" },
  },
  {
    topic: "What you can claim",
    usual: "\"Carbon neutral\" badges.",
    claim: "A Fully Offset badge",
    ours: "It shows what you offset, without claiming your emissions disappeared.",
  },
  {
    topic: "Your data",
    usual: "Linked accounts and answers kept on the company's servers.",
    claim: "Counts stay in your browser",
    ours: "They're made there and kept there.",
    computer: { text: "The extension's code is public, and you can see exactly what it sent." },
    link: { href: "/data", text: "What I read and keep" },
  },
];

export default function DifferentPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">What&apos;s different here</h1>
      <p className="mt-4 text-lg text-muted">
        Offset apps usually ask a few questions, guess a carbon number and charge you each month.
      </p>
      <div aria-hidden="true" className="mt-8 hidden border-t-2 border-b border-t-rule border-b-border py-2 text-sm text-muted sm:grid sm:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-6">
        <span />
        <span>Usually</span>
        <span>Here</span>
      </div>
      <dl className="mt-8 border-t-2 border-rule sm:mt-0 sm:border-t-0">
        {ROWS.map((r) => (
          <div key={r.topic} className="grid gap-2 border-b border-border py-5 sm:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-6">
            <dt className="font-display text-lg font-bold">{r.topic}</dt>
            <dd className="text-muted">
              <span className="text-sm sm:hidden">Usually: </span>
              {r.usual}
              {r.source && (
                <>
                  {" "}
                  <a href={r.source.href} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                    {r.source.text}
                  </a>
                </>
              )}
            </dd>
            <dd>
              <span className="text-sm text-muted sm:hidden">Here: </span>
              <strong className="block font-semibold">{r.claim}</strong>
              {r.ours}
              {r.computer && (
                <ComputerOnly>
                  {" "}
                  {r.computer.text}
                  {r.computer.link && (
                    <>
                      {" "}
                      <Link href={r.computer.link.href} className="text-accent underline underline-offset-4">
                        {r.computer.link.text}
                      </Link>
                    </>
                  )}
                </ComputerOnly>
              )}
              {r.link && (
                <>
                  {" "}
                  <Link href={r.link.href} className="text-accent underline underline-offset-4">
                    {r.link.text}
                  </Link>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-muted">
        It&apos;s made by one person, with no investors to pay back.{" "}
        <Link href="/promises" className="text-accent underline underline-offset-4">
          Read my promises
        </Link>{" "}
        or{" "}
        <Link href="/promises#who" className="text-accent underline underline-offset-4">
          see who&apos;s behind it
        </Link>
        .
      </p>
    </article>
  );
}
