import Link from "next/link";
import { WaitlistForm } from "@/components/WaitlistForm";

const POINTS = [
  {
    title: "Your real month, not a guess",
    body: "Link your utility and we use your actual usage, so a cold January and a mild May each get the offset they need.",
  },
  {
    title: "Donations to vetted charities",
    body: "Your offset goes straight to climate charities we vet, through a donation partner. We never hold the money.",
  },
  {
    title: "You approve every payment",
    body: "Each month you see your footprint and approve the donation yourself. Nothing is charged automatically.",
  },
  {
    title: "More than carbon",
    body: "We also count the air pollution, water and land behind your footprint, and fund charities that work on each.",
  },
  {
    title: "Cover what you care about",
    body: "Offset everything, or just one part, like your AI use or your flights. Each part you cover earns its own badge.",
  },
  {
    title: "Show it off",
    body: "Every approved month earns badges and adds to your streak, with an optional spot on our public list.",
  },
];

const STEPS = [
  "Link your utility, bank, car and AI accounts, or skip and start from averages.",
  "Choose what to cover: everything, one area, or just the parts you care about.",
  "Review your month and approve the donation.",
];

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <section className="py-16 sm:py-24">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-accent">Personal carbon offsets</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Find your monthly footprint and cover it, one month at a time.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          We work out the carbon, air pollution, water and land behind your home, travel, food and spending,
          then turn it into donations to charities that work on each.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
          <Link
            href="/start"
            className="rounded-lg bg-accent px-5 py-3 text-center font-medium text-white hover:bg-accent-strong"
          >
            Link your accounts
          </Link>
          <Link href="/estimate" className="text-center font-medium text-accent hover:text-accent-strong">
            Or answer a few questions
          </Link>
        </div>
        <Link
          href="/lifetime"
          className="mt-10 flex flex-col gap-1 rounded-2xl border-2 border-accent bg-accent-soft p-6 hover:bg-card sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="block text-xl font-semibold">Offset your lifetime internet and AI use</span>
            <span className="block text-muted">
              Every video, search and chatbot prompt you&apos;ve ever made, and all the ones to come. One payment.
            </span>
          </span>
          <span className="shrink-0 font-medium text-accent">See your price →</span>
        </Link>
        <p className="mt-3 text-sm text-muted">
          Just want to cover AI month to month? <Link href="/ai" className="text-accent hover:underline">Offset your AI use</Link>.
        </p>
      </section>

      <section className="grid gap-4 pb-16 sm:grid-cols-2">
        {POINTS.map((p) => (
          <div key={p.title} className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold">{p.title}</h2>
            <p className="mt-2 text-muted">{p.body}</p>
          </div>
        ))}
      </section>

      <section className="pb-16">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className="rounded-xl bg-accent-soft p-5">
              <span className="text-sm font-semibold text-accent">Step {i + 1}</span>
              <p className="mt-1">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mb-20 rounded-2xl border border-border bg-card p-8">
        <h2 className="text-2xl font-semibold tracking-tight">Accounts open soon</h2>
        <p className="mt-2 mb-5 text-muted">
          Join the waitlist and we&apos;ll email you when you can link accounts and start offsetting.
        </p>
        <WaitlistForm />
      </section>
    </div>
  );
}
