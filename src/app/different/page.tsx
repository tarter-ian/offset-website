import type { Metadata } from "next";
import Link from "next/link";
import { PAYMENT_MODE } from "@/lib/payments";

export const metadata: Metadata = { title: "What's different | My Offset" };

// Each row: what offset apps usually do, and what we do instead. Keep claims about others general and sourced.
const ROWS = [
  {
    topic: "How your footprint is found",
    usual: "A questionnaire about your home, car and diet, matched to national averages.",
    ours: "Measured from your accounts. Link your ChatGPT, Claude, YouTube and other services and we count what you actually used. The questions are there only if you'd rather not link.",
    link: { href: "/", text: "See your real numbers" },
  },
  {
    topic: "Your AI use",
    usual: "Left out, or one line for \"digital\".",
    ours: "Counted prompt by prompt, along with images, video, the AI built into search and apps, and the share of training the models. Our free browser extension does the counting on your computer.",
    link: { href: "/extension", text: "About the extension" },
  },
  {
    topic: "What counts as harm",
    usual: "Carbon only.",
    ours: "Five kinds: carbon, air pollution, water used up, land taken from nature, and e-waste. Each has its own charity, and you choose which to cover.",
    link: { href: "/method", text: "How we calculate" },
  },
  {
    topic: "How much reaches charity",
    usual: "A share is kept to run the company. One well-known subscription app reports sending about 80% to projects.",
    source: { href: "https://blog.wren.co/posts/wren-financial-report-year-two", text: "Wren, year two report" },
    ours:
      PAYMENT_MODE === "every"
        ? "All of it. You give to each charity through Every.org, and the only fee is its card fee, shown for each charity. The site runs on optional tips."
        : "All of it. The only fees are the card payment and our charity sponsor's share, each on its own line. The site runs on optional tips.",
    link: { href: "/ledger", text: "Where the money goes" },
  },
  {
    topic: "Billing",
    usual: "A monthly charge that renews until you cancel.",
    ours:
      PAYMENT_MODE === "every"
        ? "You approve each payment, monthly or yearly, and can skip any month. Autopay through Every.org is there if you want it, off by default."
        : "You approve each payment, monthly or yearly, and can skip any month. Autopay is there if you want it, off by default, with an email before every charge.",
  },
  {
    topic: "Paying once",
    usual: "A subscription, or one-off credits for a single flight.",
    ours: "AI, internet and devices can be covered for life in one payment, including what you've already used.",
  },
  {
    topic: "Choosing what to cover",
    usual: "One plan for your whole footprint.",
    ours: "Pick item by item, from AI chat to flights to the food you eat, and add only what you want.",
    link: { href: "/", text: "Browse items" },
  },
  {
    topic: "Where the money goes",
    usual: "Often cheap carbon credits, many of which have been found not to deliver.",
    ours: "Charities chosen on evidence, plus certified carbon removal only where it's measured per tonne. Every month's totals and receipts are public.",
  },
  {
    topic: "What you can claim",
    usual: "\"Carbon neutral\" badges.",
    ours: "A \"Fully Offset\" badge for what you covered, without claiming your emissions disappeared.",
  },
  {
    topic: "Your data",
    usual: "Linked accounts and answers kept on the company's servers.",
    ours: "Counts are made in your browser and kept there. The extension's code is public, and you can see exactly what it sent.",
    link: { href: "/data", text: "What we read and keep" },
  },
];

export default function DifferentPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">What&apos;s different here</h1>
      <p className="mt-4 text-lg text-muted">
        Offset apps usually ask a few questions, guess a carbon number and charge you each month. Here is what we do instead.
      </p>
      <dl className="mt-8 border-t-2 border-rule">
        <div className="hidden border-b border-border py-2 text-sm text-muted sm:grid sm:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1.4fr)] sm:gap-6">
          <span />
          <span>Usually</span>
          <span>Here</span>
        </div>
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
              {r.link && (
                <>
                  {" "}
                  <Link href={r.link.href} className="text-accent hover:underline">
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
        <Link href="/promises" className="text-accent hover:underline">
          Read our promises
        </Link>{" "}
        or{" "}
        <Link href="/promises#who" className="text-accent hover:underline">
          see who&apos;s behind it
        </Link>
        .
      </p>
    </article>
  );
}
