import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink } from "@/components/ContactLink";
import { PAYMENT_MODE } from "@/lib/payments";

export const metadata: Metadata = { title: "Terms | My Offset" };

const UPDATED = "October 12, 2026";

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "The deal",
    body: "By using this site you agree to these terms. My Offset is run by Ian Tarter. It estimates the harm from things you use and lets you donate to charities working on that harm. It's for people in the United States, and you must be 18 or older to pay.",
  },
  {
    title: "Estimates are estimates",
    body: (
      <>
        Every figure here is an estimate from published sources, shown with its source on{" "}
        <Link href="/method" className="text-accent hover:underline">
          How we calculate
        </Link>
        . Counts from your accounts come from your own browser and aren&apos;t verified by anyone. Nothing on this site is a certified
        carbon audit, and you shouldn&apos;t use it as one for a business, a regulator or a legal claim.
      </>
    ),
  },
  {
    title: "Donations",
    body: PAYMENT_MODE === "every" ? (
      <>
        Each gift goes from you to the charity through Every.org, a nonprofit donation platform; we never hold it ourselves. Every.org
        sends the receipt, decides what is tax-deductible, and its own terms cover the payment. If a charity closes or stops qualifying,
        Every.org decides where the gift goes under its rules, and{" "}
        <Link href="/ledger" className="text-accent hover:underline">
          Where the money goes
        </Link>{" "}
        will say so. Refunds are up to Every.org. If you were charged by mistake, tell us within 30 days and we&apos;ll help you ask
        for one.
      </>
    ) : (
      <>
        Your donation is held by our charity sponsor, a registered charity that runs My Offset as one of its projects, and paid to the
        charities on your summary; we never hold it ourselves. The sponsor sends the receipt and decides what is tax-deductible. If a charity closes or stops qualifying, your money goes to the nearest one working on the same
        harm, and{" "}
        <Link href="/ledger" className="text-accent hover:underline">
          Where the money goes
        </Link>{" "}
        will say so. A donation is final once it&apos;s been paid out to the charity. If you were charged by mistake, tell us within 30 days
        and we&apos;ll refund it if it hasn&apos;t been paid out yet.
      </>
    ),
  },
  {
    title: "Fees",
    body: PAYMENT_MODE === "every"
      ? "Every.org's card fee is shown for each charity, and we don't keep any of it. There are no tips or fees for using the site."
      : "The card fee and our charity sponsor's fee are listed separately, and we don't keep any of either. There are no tips or fees for using the site.",
  },
  {
    title: "Paying again",
    body: PAYMENT_MODE === "every"
      ? "You approve each gift yourself unless you tick autopay at checkout. With autopay on, Every.org charges the same gifts each month or year until you cancel them in your Every.org account. We can't email you first or hold a charge back."
      : "You approve each payment yourself unless you switch on autopay. With autopay on, we email you a few days before every charge with the amount and a one-click skip or stop. A charge more than $5 or 25% above the last one, whichever is smaller, waits for your approval. You can stop autopay at any time, and it takes effect before the next charge.",
  },
  {
    title: "Lifetime plans",
    body: "A lifetime payment covers the items it lists, at the use you entered, up to age 85. If you later use a lot more than you entered, the extra isn't covered. If we close, the donation has already reached the charities and stays there.",
  },
  {
    title: "The badge",
    body: "You may show the Fully Offset badge while your plan is paid up. It means you donated enough to cover our estimate, not that your footprint is zero. Don't call it carbon neutral, and don't use it in ads for a product.",
  },
  {
    title: "The extension",
    body: "The browser extension is free and its code is public. It only reads your accounts when you press Measure. It may break when a service changes its website; we'll fix it when we can, but can't promise it always works.",
  },
  {
    title: "Fair use",
    body: "Don't try to break the site, overload it, or use it to read other people's accounts.",
  },
  {
    title: "Our responsibility",
    body: "The site is provided as it is. As far as the law allows, we aren't liable for indirect losses, and our total liability to you is what you paid us over the last 12 months. Nothing here limits rights you have that the law says can't be limited.",
  },
  {
    title: "Changes",
    body: "If these terms change, the date at the top changes. A change that affects payments you've already set up is emailed to you first, and you can stop before it applies.",
  },
  {
    title: "Contact",
    body: (
      <>
        Questions or problems: <ContactLink />. These terms are governed by the laws of Pennsylvania.
      </>
    ),
  },
];

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">Terms</h1>
      <p className="mt-4 text-lg text-muted">
        Updated {UPDATED}. Written to be read. See also{" "}
        <Link href="/promises" className="text-accent hover:underline">
          our promises
        </Link>{" "}
        and the{" "}
        <Link href="/privacy" className="text-accent hover:underline">
          privacy policy
        </Link>
        .
      </p>
      <dl className="mt-8 border-t-2 border-rule">
        {SECTIONS.map((s) => (
          <div key={s.title} className="grid gap-1 border-b border-border py-5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-8">
            <dt className="font-display text-lg font-bold">{s.title}</dt>
            <dd>{s.body}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
