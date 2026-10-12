import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink } from "@/components/ContactLink";
import { PAYMENT_MODE } from "@/lib/payments";

export const metadata: Metadata = { title: "Our promises | My Offset" };

// Each promise answers a common complaint about offset apps.
const PROMISES = [
  {
    title: "Never charged without your say-so",
    body: PAYMENT_MODE === "every"
      ? "You approve each gift yourself, on Every.org, one charity at a time. Nothing repeats unless you tick autopay at checkout. If you do, Every.org charges the same amounts each month or year until you cancel them in your Every.org account, even if your use changes. We can't email you before those charges or hold one back, so leave autopay off if you want to approve each one."
      : "By default you approve each payment yourself, once a year or each month. Autopay is off unless you switch it on. If you do, we email you a few days before every charge with the amount and a one-click skip or stop, and a month that comes out more than $5 or 25% higher than the last, whichever is smaller, waits for your approval instead. The email shows the exact limit in dollars.",
  },
  {
    title: "Your donation goes straight to charities",
    body: PAYMENT_MODE === "every"
      ? "Each gift goes from you to the charity through Every.org, a nonprofit donation platform that sends you the tax receipt. We never hold the money ourselves. Every month's totals are public."
      : "Your donation is held by our charity sponsor, a registered charity, which sends you the tax receipt and pays the charities on your summary each month. We never hold the money ourselves. Every month's totals and receipts are public.",
    link: { href: "/ledger", text: "Where the money goes" },
  },
  {
    title: "No cut, just costs passed on",
    body: PAYMENT_MODE === "every"
      ? "We don't make money on your donation. Each charity is paid separately through Every.org, which charges card payments 2.2% + 30¢ and bank payments nothing; the fee is shown for each charity. Paying yearly means one 30¢ fee per charity instead of twelve. Tips toward running the site are separate and off unless you choose to give one."
      : "We don't make money on your donation. Two fees are passed on at cost, each on its own line: the card payment (30¢ plus 2.2%) and our charity sponsor's 8%, which pays for holding the money, sending tax receipts and paying the charities. Paying yearly means one 30¢ charge instead of twelve. At checkout you can add a tip toward running the site; it's off unless you pick it.",
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
            My Offset is made by Ian Tarter, a Master of Human-Computer Interaction student at Carnegie Mellon University. It&apos;s one person, not a company with a
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
