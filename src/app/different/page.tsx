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
  ours: string;
  source?: { href: string; text: string };
  link?: { href: string; text: string };
  computer?: { text: string; link?: { href: string; text: string } };
};
const ROWS: Row[] = [
  {
    topic: "How your footprint is found",
    usual: "A questionnaire about your home, car and diet, matched to national averages.",
    ours: "Measured from your accounts. Link your ChatGPT, Claude, YouTube and other services and I count what you actually used. The questions are there only if you'd rather not link.",
    link: { href: "/", text: "See your real numbers" },
  },
  {
    topic: "Your AI use",
    usual: "Left out, or one line for \"digital\".",
    ours: "Counted prompt by prompt, along with images, video, the AI built into search and apps, and the share of training the models.",
    computer: { text: "The free browser extension I made does the counting on your computer.", link: { href: "/extension", text: "About the extension" } },
  },
  {
    topic: "What counts as harm",
    usual: "Carbon only.",
    ours: "Five kinds: carbon, air pollution, water used up, land taken from nature, and e-waste. Four charities share the work: carbon and air both go to Clean Air Task Force, and the others each have their own.",
    link: { href: "/method", text: "How it's calculated" },
  },
  {
    topic: "How much reaches charity",
    usual: "A share is kept to run the company. One well-known subscription app reports sending about 80% to projects.",
    source: { href: "https://blog.wren.co/posts/wren-financial-report-year-two", text: "Wren, year two report" },
    ours: forMode({
      every:
        "All of it. You give to each charity through Every.org, and the only fee is its card fee, shown for each charity. I pay for running the site myself.",
      pledge:
        "All of it. You give to each charity through Pledge, a nonprofit giving platform. Pledge pays the card fee on gifts up to $1,000, so there is no fee on most gifts. I pay for running the site myself.",
      pledgeapi: `All of your donation. You pay me once through Stripe, and I give every dollar of it to the charities through Pledge, a nonprofit giving platform. The only fees are Stripe's card fee and Pledge's ${PLEDGE_API_FEE_LABEL} technology fee and ${PLEDGE_API_CARD_LABEL} card fee, each on its own line. I pay for running the site myself.`,
      endaoment: `All of it. You give once through Endaoment, and the only fees are the card payment and Endaoment's ${ENDAOMENT_IN_LABEL} in and ${ENDAOMENT_GRANT_LABEL} out, each on its own line. I pay for running the site myself.`,
      sponsor:
        "All of it. The only fees are the card payment and my charity sponsor's share, each on its own line. I pay for running the site myself.",
    }),
    link: { href: "/ledger", text: "Where the money goes" },
  },
  {
    topic: "Billing",
    usual: "A monthly charge that renews until you cancel.",
    ours:
      PAYMENT_MODE === "endaoment"
        ? "You approve each gift, monthly or yearly, and can skip any month. Nothing repeats on its own."
        : PAYMENT_MODE === "every"
        ? "You approve each payment, monthly or yearly, and can skip any month. Autopay through Every.org is there if you want it, off by default."
        : PAYMENT_MODE === "pledge"
        ? "You approve each gift, monthly or yearly, and can skip any month. Nothing repeats on its own."
        : PAYMENT_MODE === "pledgeapi"
        ? "You approve each payment, monthly or yearly, and can skip any month. Nothing repeats on its own."
        : "You approve each payment, monthly or yearly, and can skip any month. Autopay is there if you want it, off by default, with an email before every charge.",
  },
  {
    topic: "Paying once",
    usual: "A subscription, or one-off credits for a single flight.",
    ours: "AI, internet and devices can be offset for life in one gift, including what you've already used.",
  },
  {
    topic: "Choosing what to offset",
    usual: "One plan for your whole footprint.",
    ours: "Pick item by item, from AI chat to flights to the food you eat, and add only what you want.",
    link: { href: "/", text: "Browse items" },
  },
  {
    topic: "Where the money goes",
    usual: "Often cheap carbon credits, many of which have been found not to deliver.",
    ours: forMode({
      every: "Charities chosen on evidence, and no carbon credits. Every month's totals are public, and Every.org emails you the receipt for each gift.",
      endaoment: "Charities chosen on evidence, and no carbon credits. Every month's totals are public, and Endaoment emails you the receipt.",
      pledge: "Charities chosen on evidence, and no carbon credits. Every month's totals are public, and Pledge emails you the receipt for each gift.",
      pledgeapi: "Charities chosen on evidence, and no carbon credits. Every month's totals are public, and Pledge records each gift in your name.",
      sponsor: "Charities chosen on evidence, and no carbon credits. Every month's totals are public, and my charity sponsor emails you the receipt.",
    }),
  },
  {
    topic: "What you can claim",
    usual: "\"Carbon neutral\" badges.",
    ours: "A \"Fully Offset\" badge for what you offset, without claiming your emissions disappeared.",
  },
  {
    topic: "Your data",
    usual: "Linked accounts and answers kept on the company's servers.",
    ours: "Counts are made in your browser and kept there.",
    computer: { text: "The extension's code is public, and you can see exactly what it sent." },
    link: { href: "/data", text: "What I read and keep" },
  },
];

export default function DifferentPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">What&apos;s different here</h1>
      <p className="mt-4 text-lg text-muted">
        Offset apps usually ask a few questions, guess a carbon number and charge you each month. Here is what I do instead.
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
        It&apos;s made by one person, not a company with investors to pay back.{" "}
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
