import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Our promises | Offset" };

// Each promise answers a common complaint about offset apps.
const PROMISES = [
  {
    title: "We never charge you automatically",
    body: "Each month you see your footprint and approve the donation yourself. Skip a month or stop any time, with nothing to cancel.",
  },
  {
    title: "Your donation goes straight to charities",
    body: "Donations pass through our donation partner directly to the charities on your summary, and you get the partner's receipt. We never hold the money.",
  },
  {
    title: "One simple fee, shown up front",
    body: "Our fee is $1 for each area of your life you cover, like home or travel, up to $4 a month. It's listed separately from your donation on every summary.",
  },
  {
    title: "We fund charities, not carbon credits",
    body: "Many carbon credits have turned out not to deliver what they claimed. We give to charities chosen on evidence of impact instead, and we never claim your donation removed a set number of tonnes.",
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
    <article className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Our promises</h1>
      <p className="mt-4 text-lg text-muted">
        People have good reasons to distrust offset apps. Here is how we handle each one.
      </p>
      <ul className="mt-8 space-y-4">
        {PROMISES.map((p) => (
          <li key={p.title} className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-1 text-muted">{p.body}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-muted">
        See <Link href="/method" className="text-accent hover:underline">how we calculate</Link> for every factor and
        source.
      </p>
    </article>
  );
}
