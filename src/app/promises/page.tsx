import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Our promises | Offset" };

// Each promise answers a common complaint about offset apps.
const PROMISES = [
  {
    title: "We never charge you automatically",
    body: "You see your footprint and approve each payment yourself, once a year or each month, whichever you choose. Skip or stop any time, with nothing to cancel.",
  },
  {
    title: "Your donation goes straight to charities",
    body: "Donations pass through our donation partner directly to the charities on your summary, and you get the partner's receipt. We never hold the money.",
  },
  {
    title: "One simple fee, shown up front",
    body: "Our fee is $1 a month for each thing you cover, like driving or electricity, up to $4 a month, with two months free when you pay yearly. One-time payments carry a single $3 fee. It's listed separately from your donation on every summary.",
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
            <dd>{p.body}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-8 text-muted">
        See <Link href="/method" className="text-accent hover:underline">how we calculate</Link> for every factor and
        source.
      </p>
    </article>
  );
}
