import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink } from "@/components/ContactLink";

export const metadata: Metadata = { title: "Our promises | Offset" };

// Each promise answers a common complaint about offset apps.
const PROMISES = [
  {
    title: "Never charged without your say-so",
    body: "By default you approve each payment yourself, once a year or each month. Autopay is off unless you switch it on. If you do, we email you a few days before every charge with the amount and a one-click skip or stop, and a month that comes out more than 25% higher than the last waits for your approval instead.",
  },
  {
    title: "Your donation goes straight to charities",
    body: "Donations pass through our donation partner directly to the charities on your summary, and you get the partner's receipt. We never hold the money. Every month's totals and receipts are public.",
    link: { href: "/ledger", text: "Where the money goes" },
  },
  {
    title: "No cut, just the card fee",
    body: "We don't make money on your donation. The only fee is what the card payment costs: 30¢ plus 3.6% of each payment, which is well under a dollar on a typical monthly plan. Paying yearly means one 30¢ charge instead of twelve. It's listed separately from your donation on every summary. At checkout you can add a tip toward running the site; it's off unless you pick it.",
  },
  {
    title: "No cheap, unverified carbon credits",
    body: "Many cheap carbon credits have turned out not to deliver what they claimed. We give to charities chosen on evidence of impact, and the only credits we buy are certified carbon removal, measured per tonne. We only say tonnes were removed when they were measured.",
  },
  {
    title: "Every number is explained",
    body: "Each line of your footprint shows where it came from and how sure we are. You can see every factor we use and correct any estimate.",
  },
  {
    title: "Your data stays yours",
    body: "Linked accounts are read-only and we take only what the estimate needs. Unlink or delete everything with one click. We will never sell your data.",
    link: { href: "/data", text: "What we read and keep" },
  },
  {
    title: "Giving is not a substitute for cutting back",
    body: "Your summary shows the changes that would shrink your footprint most. Donations fund climate work alongside those changes, not instead of them.",
  },
  {
    title: "If we ever close",
    body: "Donations already made stay with the charities. You'll be able to download all your data, and we'll delete it after that.",
  },
];

export default function PromisesPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">Our promises</h1>
      <p className="mt-4 text-lg text-muted">
        People have good reasons to distrust offset apps. Here is how we handle each one.
      </p>
      <dl className="mt-8 border-t-2 border-rule">
        {PROMISES.map((p) => (
          <div key={p.title} className="grid gap-1 border-b border-border py-5 sm:grid-cols-[15rem_minmax(0,1fr)] sm:gap-8">
            <dt className="font-display text-lg font-bold">{p.title}</dt>
            <dd>
              {p.body}
              {"link" in p && p.link && (
                <>
                  {" "}
                  <Link href={p.link.href} className="text-accent hover:underline">
                    {p.link.text}
                  </Link>
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <section id="who" className="mt-10 flex scroll-mt-24 items-start gap-5 border-t-2 border-rule pt-6">
        {/* Same photo as iantarter.com. Swap for a local copy once there's a final one. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://iantarter.com/wp-content/uploads/2023/08/img-2643-edited-1.png?w=240"
          alt="Ian Tarter"
          width={96}
          height={96}
          className="size-24 shrink-0 rounded-md border border-border object-cover"
        />
        <div>
          <h2 className="font-display text-lg font-bold">Who&apos;s behind this</h2>
          <p className="mt-1">
            Offset is made by Ian Tarter, a Master of Human-Computer Interaction student at Carnegie Mellon University. It&apos;s one person, not a company with a
            marketing team, and every number on this site traces back to a source you can check.{" "}
            <a href="https://iantarter.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              iantarter.com
            </a>
          </p>
          <p className="mt-2">
            Questions, problems or a charge you didn&apos;t expect: <ContactLink />.
          </p>
        </div>
      </section>
      <p className="mt-8 text-muted">
        See <Link href="/method" className="text-accent hover:underline">how we calculate</Link> for every factor and
        source.
      </p>
    </article>
  );
}
