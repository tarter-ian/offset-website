import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink } from "@/components/ContactLink";
import { forMode } from "@/lib/payments";
import { ENDAOMENT_GRANT_LABEL, ENDAOMENT_IN_LABEL, PLEDGE_API_CARD_LABEL, PLEDGE_API_FEE_LABEL, PLEDGE_FREE_LABEL, STRIPE_CARD_LABEL } from "@/lib/pricing";

export const metadata: Metadata = { title: "Promises | My Offset" };

// Each promise answers a common complaint about offset apps.
const PROMISES = [
  {
    title: "Never charged without your say-so",
    body: forMode({
      every:
        "You approve each gift yourself, on Every.org, one charity at a time. Nothing repeats unless you tick autopay at checkout. If you do, Every.org charges the same gifts each month or year until you cancel them in your Every.org account. I can't email you before those charges or hold one back, so leave autopay off if you want to approve each one.",
      endaoment:
        "You approve each gift yourself, on Endaoment's page for the My Offset fund. Nothing repeats on its own: each month or year, you come back and give again.",
      pledge:
        "You approve each gift yourself, in Pledge's form, one charity at a time. Nothing repeats on its own: each month or year, you come back and give again.",
      pledgeapi:
        "You approve each payment yourself, on Stripe's checkout page. It's one payment for all the charities. Nothing repeats on its own: each month or year, you come back and pay again.",
      sponsor:
        "By default you approve each payment yourself, once a year or each month. Autopay is off unless you switch it on. If you do, I email you a few days before every charge with the amount and a one-click skip or stop, and a month that comes out more than $5 or 25% higher than the last, whichever is smaller, waits for your approval instead. The email shows the exact limit in dollars.",
    }),
  },
  {
    title: forMode({
      every: "Your donation goes straight to charities",
      endaoment: "Your donation goes to the charities",
      pledge: "Your donation goes straight to charities",
      pledgeapi: "Every dollar of your donation goes to the charities",
      sponsor: "Your donation goes straight to charities",
    }),
    body: forMode({
      every:
        "Each gift goes from you to the charity through Every.org, a nonprofit donation platform that sends you the tax receipt. I never hold the money myself. Every month's totals are public.",
      pledge:
        "Each gift goes from you to the charity through Pledge, a nonprofit giving platform that emails you the tax receipt. None of it passes through My Offset. Every month's totals are public.",
      endaoment:
        "You give to My Offset's fund at Endaoment, a nonprofit that sends you the tax receipt and grants the money on to each charity in the amounts checkout shows. I never hold the money myself.",
      pledgeapi:
        "You pay My Offset once, through Stripe. I then give each charity its part through Pledge, a nonprofit giving platform, in the amounts checkout shows. Pledge records each gift in your name. Every month's totals are public.",
      sponsor:
        "Your donation is held by my charity sponsor, a registered charity, which sends you the tax receipt and pays the charities on your summary each month. I never hold the money myself. Every month's totals are public.",
    }),
    link: { href: "/ledger", text: "Where the money goes" },
  },
  {
    title: "No cut, just costs passed on",
    body: forMode({
      every:
        "I don't make money on your donation. Each charity is paid separately through Every.org, which charges card payments 2.2% + 30¢ and bank payments nothing; the fee is shown for each charity. Paying yearly means one 30¢ fee per charity instead of twelve. There are no tips; I pay for running the site myself.",
      pledge: `I don't make money on your donation. Each charity is paid separately through Pledge, which pays the card fee on gifts up to ${PLEDGE_FREE_LABEL}. Above that, the card fee is shown for that charity. Pledge may ask for an optional tip, which goes to Pledge; My Offset gets none of it. I pay for running the site myself.`,
      pledgeapi: `I don't make money on your donation. The fees are passed on at cost, each on its own line: Stripe's card fee (${STRIPE_CARD_LABEL}) on your payment, and Pledge's ${PLEDGE_API_FEE_LABEL} technology fee and ${PLEDGE_API_CARD_LABEL} card fee on the gifts I make through it. Paying yearly means one 30¢ fee instead of twelve. There are no tips; I pay for running the site myself.`,
      endaoment: `I don't make money on your donation. You make one gift, and the fees are passed on at cost, each on its own line: the card payment and Endaoment's ${ENDAOMENT_IN_LABEL} as the gift comes in and ${ENDAOMENT_GRANT_LABEL} as it is granted out. Paying yearly means one card fee instead of twelve. There are no tips; I pay for running the site myself.`,
      sponsor:
        "I don't make money on your donation. Two fees are passed on at cost, each on its own line: the card payment (30¢ plus 2.2%) and my charity sponsor's 8%, which pays for holding the money, sending tax receipts and paying the charities. Paying yearly means one 30¢ charge instead of twelve. There are no tips; I pay for running the site myself.",
    }),
  },
  {
    title: "No cheap, unverified carbon credits",
    body: "Many cheap carbon credits have turned out not to deliver what they claimed. I give to charities chosen on evidence of impact, and I buy no carbon credits. I never say tonnes were removed, because policy work can't be measured that way.",
  },
  {
    title: "Every number is explained",
    body: "Each line of your footprint shows where it came from and how sure I am. You can see every factor I use and correct any estimate.",
  },
  {
    title: "Your data stays yours",
    body: "Linked accounts are read-only and I take only what the estimate needs. Unlink or delete everything with one click. I will never sell your data.",
    link: { href: "/data", text: "What I read and keep" },
  },
  {
    title: "Giving is not a substitute for cutting back",
    body: "Your summary shows the changes that would shrink your footprint most. Donations fund climate work alongside those changes, not instead of them.",
  },
  {
    title: "If I ever close the site",
    body: "Donations already made stay with the charities. You'll be able to download all your data, and I'll delete it after that.",
  },
];

export default function PromisesPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-4xl font-extrabold [font-stretch:85%]">Promises</h1>
      <p className="mt-4 text-lg text-muted">
        People have good reasons to distrust offset apps. Here is how I handle each one.
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
                  <Link href={p.link.href} className="text-accent underline underline-offset-4">
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
            <a href="https://iantarter.com" target="_blank" rel="noreferrer" className="text-accent underline underline-offset-4">
              iantarter.com
            </a>
          </p>
          <p className="mt-2">
            Questions, problems or a charge you didn&apos;t expect: <ContactLink />.
          </p>
        </div>
      </section>
      <p className="mt-8 text-muted">
        See <Link href="/method" className="text-accent underline underline-offset-4">how it&apos;s calculated</Link> for every factor and
        source.
      </p>
    </article>
  );
}
